import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  PanResponder,
  Modal,
  Image,
  Animated,
  Dimensions,
  Easing
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle } from "react-native-svg";
import { SubscriptionProvider, useSubscription } from "./SubscriptionContext";

// Tab icon using PNG assets (pass -active or -inactive based on state)
function TabIcon({
  source,
  size = 24,
}: {
  source: number;
  size?: number;
}) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

const RING_SIZE = 112;
const RING_STROKE = 8;

function CircularProgressRing({
  progress,
  value,
  size = RING_SIZE,
  suffix = "",
}: {
  progress: number;
  value: number;
  size?: number;
  suffix?: string;
}) {
  const stroke = Math.max(6, (RING_STROKE / RING_SIZE) * size);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (270 / 360);
  const gapLength = circumference * (90 / 360);
  const offset = circumference * (135 / 360);

  const safeProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const displayValue = Math.round(Number.isFinite(value) ? value : 0);
  const displayText = `${displayValue}${suffix}`;

  return (
    <View style={{ width: size, height: size, position: "relative" }} pointerEvents="none">
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E0E0E0"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={-offset}
        />
        {safeProgress > 0.001 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#4263EB"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${safeProgress * arcLength} ${circumference}`}
            strokeDashoffset={-offset}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center" }]} pointerEvents="none">
        <Text style={{ fontSize: size <= 72 ? 12 : 14, fontWeight: "800", color: "#111827" }}>{displayText}</Text>
      </View>
    </View>
  );
}

// Wheel Picker Component
const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

type WheelPickerProps = {
  items: Array<{ label: string; value: string }>;
  selectedValue: string;
  onValueChange: (value: string) => void;
  style?: any;
};

const WheelPicker: React.FC<WheelPickerProps> = ({
  items,
  selectedValue,
  onValueChange,
  style
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const index = items.findIndex((item) => item.value === selectedValue);
    return index >= 0 ? index : 0;
  });

  useEffect(() => {
    const index = items.findIndex((item) => item.value === selectedValue);
    if (index >= 0) {
      setSelectedIndex(index);
      // Use setTimeout to ensure ScrollView is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: false
        });
      }, 100);
    }
  }, [selectedValue, items]);

  // Initial scroll on mount
  useEffect(() => {
    const index = items.findIndex((item) => item.value === selectedValue);
    if (index >= 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: false
        });
      }, 200);
    }
  }, []);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    if (clampedIndex !== selectedIndex) {
      setSelectedIndex(clampedIndex);
      onValueChange(items[clampedIndex].value);
    }
  };

  const handleMomentumScrollEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    const targetY = clampedIndex * ITEM_HEIGHT;
    
    // Only snap if we're not already at the target position
    if (Math.abs(y - targetY) > 1) {
      scrollViewRef.current?.scrollTo({
        y: targetY,
        animated: true
      });
    }
    
    if (clampedIndex !== selectedIndex) {
      setSelectedIndex(clampedIndex);
      onValueChange(items[clampedIndex].value);
    }
  };

  return (
    <View style={[styles.wheelPickerContainer, style]}>
      <View style={styles.wheelPickerSelection} pointerEvents="none" />
      <ScrollView
        ref={scrollViewRef}
        style={styles.wheelPickerScroll}
        contentContainerStyle={styles.wheelPickerContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        bounces={false}
        scrollEnabled={true}
      >
        {items.map((item, index) => {
          const distance = Math.abs(index - selectedIndex);
          const opacity = distance === 0 ? 1 : Math.max(0.3, 1 - distance * 0.2);
          const scale = distance === 0 ? 1 : Math.max(0.8, 1 - distance * 0.1);
          return (
            <View
              key={item.value}
              style={[
                styles.wheelPickerItem,
                { opacity, transform: [{ scale }] }
              ]}
            >
              <Text style={styles.wheelPickerItemText}>{item.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Collapsible Field Component
type CollapsibleFieldProps = {
  label: string;
  value: string;
  isExpanded: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

const CollapsibleField: React.FC<CollapsibleFieldProps> = ({
  label,
  value,
  isExpanded,
  onPress,
  children
}) => {
  return (
    <View style={styles.collapsibleFieldContainer}>
      <View style={styles.collapsibleFieldRow}>
        <Text style={styles.collapsibleFieldLabel}>{label}</Text>
        <TouchableOpacity style={styles.collapsibleFieldValue} onPress={onPress}>
          <Text style={styles.collapsibleFieldValueText}>{value}</Text>
        </TouchableOpacity>
      </View>
      {isExpanded && (
        <View style={styles.collapsibleFieldExpanded}>
          {children}
        </View>
      )}
    </View>
  );
};

const DELETE_REVEAL_WIDTH = 100;
const SWIPE_SENSITIVITY = 1.3; // Slower, smoother tracking

/** Swipeable item card: tap opens detail, swipe left reveals red delete. */
const SwipeableItemCard: React.FC<{
  item: { id: string; name: string; quantity: number; unit: string; grams: number; nutrients: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number } };
  onOpenDetail: () => void;
  onDelete: () => void;
  cardStyle: any;
  cardContent: React.ReactNode;
}> = ({ item, onOpenDetail, onDelete, cardStyle, cardContent }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          const { dx } = g;
          const amplified = lastOffset.current + dx * SWIPE_SENSITIVITY;
          const newVal = Math.max(-DELETE_REVEAL_WIDTH, Math.min(0, amplified));
          translateX.setValue(newVal);
        },
        onPanResponderRelease: (_, g) => {
          const { dx, vx } = g;
          const current = lastOffset.current + dx * SWIPE_SENSITIVITY;
          const shouldReveal = dx < -10 || vx < -0.2 || current < -DELETE_REVEAL_WIDTH * 0.4;
          const target = shouldReveal ? -DELETE_REVEAL_WIDTH : 0;
          lastOffset.current = target;
          Animated.timing(translateX, {
            toValue: target,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        },
      }),
    [translateX]
  );
  return (
    <View style={{ marginBottom: 14, overflow: "hidden" }} {...panResponder.panHandlers}>
      <View
        style={{
          position: "absolute",
          right: 2,
          top: 0,
          bottom: 0,
          width: DELETE_REVEAL_WIDTH,
          backgroundColor: "#DC2626",
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 0,
        }}
      >
        <TouchableOpacity
          onPress={onDelete}
          style={{ flex: 1, justifyContent: "center", alignItems: "center", width: "100%" }}
        >
          <Image
          source={require("./assets/trash-icon.png")}
          style={{ width: 28, height: 28 }}
          resizeMode="contain"
        />
        </TouchableOpacity>
      </View>
      <Animated.View style={[{ zIndex: 1 }, { transform: [{ translateX }] }]}>
        <View style={{ borderRadius: 16, overflow: "hidden" }}>
          <PressableCard style={cardStyle} onPress={onOpenDetail}>
            {cardContent}
          </PressableCard>
        </View>
      </Animated.View>
    </View>
  );
};

/** Card with press affordance: scale down to 0.98 on press, subtle shadow. */
const PressableCard: React.FC<{
  style: any;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ style, onPress, children }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// For local testing, use: http://YOUR_MAC_IP:4000/v1
// For production, use: https://meal-tracking-api.onrender.com/v1
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://meal-tracking-api.onrender.com/v1";

type NutrientTotals = {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  omega_3_g: number;
  potassium_mg: number;
  vitamin_d_iu: number;
  magnesium_mg: number;
  vitamin_c_mg: number;
  vitamin_a_mcg: number;
};

type ParsedFoodRole = "main" | "side" | "cooking-fat" | "sauce" | "beverage" | "unknown";

type ParsedFood = {
  name: string;
  originalText: string;
  quantity?: number;
  unit?: string;
  approx?: boolean;
  role: ParsedFoodRole;
  confidence: number;
  notes?: string;
};

type UserProfile = {
  dateOfBirth: string | null; // YYYY-MM-DD format
  genderAtBirth: "male" | "female" | null;
  heightCm: number | null;
  heightUnit: "cm" | "in";
  weightKg: number | null;
  goal: string | null;
  activityLevel: "low" | "medium" | "high" | null;
};

type MealResponse = {
  nutrients: NutrientTotals;
};

type MealState = {
  id: string;
  label: string;
  nutrients: NutrientTotals;
};

const emptyTotals = (): NutrientTotals => ({
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  sodium_mg: 0,
  cholesterol_mg: 0,
  omega_3_g: 0,
  potassium_mg: 0,
  vitamin_d_iu: 0,
  magnesium_mg: 0,
  vitamin_c_mg: 0,
  vitamin_a_mcg: 0
});

const sumTotals = (a: NutrientTotals, b: NutrientTotals): NutrientTotals => ({
  calories_kcal: a.calories_kcal + b.calories_kcal,
  protein_g: a.protein_g + b.protein_g,
  carbs_g: a.carbs_g + b.carbs_g,
  fat_g: a.fat_g + b.fat_g,
  fiber_g: (a.fiber_g ?? 0) + (b.fiber_g ?? 0),
  sodium_mg: (a.sodium_mg ?? 0) + (b.sodium_mg ?? 0),
  cholesterol_mg: (a.cholesterol_mg ?? 0) + (b.cholesterol_mg ?? 0),
  omega_3_g: (a.omega_3_g ?? 0) + (b.omega_3_g ?? 0),
  potassium_mg: (a.potassium_mg ?? 0) + (b.potassium_mg ?? 0),
  vitamin_d_iu: (a.vitamin_d_iu ?? 0) + (b.vitamin_d_iu ?? 0),
  magnesium_mg: (a.magnesium_mg ?? 0) + (b.magnesium_mg ?? 0),
  vitamin_c_mg: (a.vitamin_c_mg ?? 0) + (b.vitamin_c_mg ?? 0),
  vitamin_a_mcg: (a.vitamin_a_mcg ?? 0) + (b.vitamin_a_mcg ?? 0)
});

const scaleTotals = (t: NutrientTotals, factor: number): NutrientTotals => ({
  calories_kcal: t.calories_kcal * factor,
  protein_g: t.protein_g * factor,
  carbs_g: t.carbs_g * factor,
  fat_g: t.fat_g * factor,
  fiber_g: (t.fiber_g ?? 0) * factor,
  sodium_mg: (t.sodium_mg ?? 0) * factor,
  cholesterol_mg: (t.cholesterol_mg ?? 0) * factor,
  omega_3_g: (t.omega_3_g ?? 0) * factor,
  potassium_mg: (t.potassium_mg ?? 0) * factor,
  vitamin_d_iu: (t.vitamin_d_iu ?? 0) * factor,
  magnesium_mg: (t.magnesium_mg ?? 0) * factor,
  vitamin_c_mg: (t.vitamin_c_mg ?? 0) * factor,
  vitamin_a_mcg: (t.vitamin_a_mcg ?? 0) * factor
});

const subtractTotals = (
  a: NutrientTotals,
  b: NutrientTotals
): NutrientTotals => ({
  calories_kcal: a.calories_kcal - b.calories_kcal,
  protein_g: a.protein_g - b.protein_g,
  carbs_g: a.carbs_g - b.carbs_g,
  fat_g: a.fat_g - b.fat_g,
  fiber_g: (a.fiber_g ?? 0) - (b.fiber_g ?? 0),
  sodium_mg: (a.sodium_mg ?? 0) - (b.sodium_mg ?? 0),
  cholesterol_mg: (a.cholesterol_mg ?? 0) - (b.cholesterol_mg ?? 0),
  omega_3_g: (a.omega_3_g ?? 0) - (b.omega_3_g ?? 0),
  potassium_mg: (a.potassium_mg ?? 0) - (b.potassium_mg ?? 0),
  vitamin_d_iu: (a.vitamin_d_iu ?? 0) - (b.vitamin_d_iu ?? 0),
  magnesium_mg: (a.magnesium_mg ?? 0) - (b.magnesium_mg ?? 0),
  vitamin_c_mg: (a.vitamin_c_mg ?? 0) - (b.vitamin_c_mg ?? 0),
  vitamin_a_mcg: (a.vitamin_a_mcg ?? 0) - (b.vitamin_a_mcg ?? 0)
});

const round = (value: number) => Math.round(value * 10) / 10;
const stripParenthetical = (value: string) => value.replace(/\s*\([^)]*\)\s*/g, " ").trim();
const capitalizeFirst = (value: string) =>
  value.length === 0 ? "" : value.charAt(0).toUpperCase() + value.slice(1);

/** Convert health quotient (0-100) to descriptive level and color */
const getHealthQuotientLevel = (score: number): { label: string; color: string } => {
  if (score >= 80) return { label: "Excellent", color: "#22C55E" };
  if (score >= 65) return { label: "Very Good", color: "#84CC16" };
  if (score >= 50) return { label: "Good", color: "#EAB308" };
  if (score >= 35) return { label: "Fair", color: "#F97316" };
  return { label: "Poor", color: "#EF4444" };
};

/** Determine top qualities of a food based on nutrients */
const getTopQualities = (nutrients: NutrientTotals): string[] => {
  const qualities: string[] = [];
  const calories = nutrients.calories_kcal || 1;
  const proteinPerCal = (nutrients.protein_g || 0) / calories * 100;
  const fiberPerCal = (nutrients.fiber_g || 0) / calories * 100;
  const carbsRatio = (nutrients.carbs_g || 0) / calories;
  const fatRatio = (nutrients.fat_g || 0) / calories;
  
  if (proteinPerCal > 0.5 && nutrients.protein_g > 0) qualities.push("High Protein");
  if (fiberPerCal > 0.3 && nutrients.fiber_g > 0) qualities.push("High Fiber");
  if (carbsRatio < 0.4 && nutrients.carbs_g > 0) qualities.push("Low carbs");
  if (fatRatio < 0.2 && nutrients.fat_g > 0) qualities.push("Low Fat");
  if ((nutrients.vitamin_c_mg || 0) > 10 || (nutrients.vitamin_a_mcg || 0) > 100) qualities.push("Rich in Vitamins");
  if ((nutrients.potassium_mg || 0) > 200 || (nutrients.magnesium_mg || 0) > 30) qualities.push("Rich in Minerals");
  
  return qualities.slice(0, 3);
};
const normalizeFoodNameForKey = (name: string) =>
  stripParenthetical(name).trim().toLowerCase();

// Normalize plural/singular forms to singular for deduplication
const normalizePlural = (text: string): string => {
  // Common plural endings: s, es, ies, ves
  // Convert to singular
  if (text.endsWith("ies") && text.length > 3) {
    // e.g., "berries" -> "berry"
    return text.slice(0, -3) + "y";
  }
  if (text.endsWith("ves") && text.length > 3) {
    // e.g., "leaves" -> "leaf"
    const exceptions: Record<string, string> = {
      leaves: "leaf",
      knives: "knife",
      lives: "life",
      halves: "half",
    };
    if (exceptions[text]) return exceptions[text];
  }
  if (text.endsWith("es") && text.length > 2) {
    const beforeEs = text.slice(0, -2);
    // Only remove "es" if the word before it ends in ch, sh, s, x, z, or o
    // These are words that genuinely add "es" for plural (e.g., "dishes", "boxes", "potatoes")
    if (beforeEs.match(/[chshsxz]$/) || beforeEs.endsWith("o")) {
      return beforeEs;
    }
    // For other words ending in "es", they might just be regular "s" plurals
    // (e.g., "apples" -> "apple", not "appl"), so fall through to "s" removal
  }
  // Simple "s" ending: remove it (handles most regular plurals)
  if (text.endsWith("s") && text.length > 1) {
    return text.slice(0, -1);
  }
  return text;
};

// Normalize food name for deduplication: lowercase, trim, normalize spaces, handle plurals
const normalizeFoodNameForDedup = (name: string): string => {
  const cleaned = stripParenthetical(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // Normalize multiple spaces to single space
  
  // Split into words and normalize each word's plural form
  const words = cleaned.split(" ");
  const normalizedWords = words.map((word) => normalizePlural(word));
  return normalizedWords.join(" ");
};

// Get canonical version (properly capitalized) from normalized key
const getCanonicalFoodName = (name: string): string => {
  return capitalizeFirst(stripParenthetical(name).trim());
};

/** Infer typical serving size (grams) from food name. Used for saved foods display and when logging new foods. */
const inferDefaultServingGrams = (name: string): number => {
  const lower = name.toLowerCase();
  const rules: { keywords: string[]; grams: number }[] = [
    { keywords: ["vitamin", "omega", "tablet", "capsule", "supplement", "pill", "softgel", "gummy", "multivitamin", "probiotic"], grams: 1 },
    { keywords: ["chapati", "chapatti", "roti", "phulka"], grams: 50 },
    { keywords: ["naan"], grams: 90 },
    { keywords: ["paratha", "parantha"], grams: 80 },
    { keywords: ["chicken breast", "chicken thigh"], grams: 120 },
    { keywords: ["chicken drumstick"], grams: 75 },
    { keywords: ["chicken"], grams: 100 },
    { keywords: ["salmon", "fish fillet", "tilapia", "cod"], grams: 120 },
    { keywords: ["steak", "beef"], grams: 100 },
    { keywords: ["egg"], grams: 50 },
    { keywords: ["walnut", "almond", "cashew", "pistachio", "peanut", "nut"], grams: 28 },
    { keywords: ["bread slice", "slice of bread"], grams: 30 },
    { keywords: ["bread"], grams: 40 },
    { keywords: ["banana"], grams: 120 },
    { keywords: ["apple", "orange", "pear"], grams: 150 },
    { keywords: ["mango"], grams: 200 },
    { keywords: ["strawberry", "blueberry", "raspberry", "berry"], grams: 100 },
    { keywords: ["milk"], grams: 240 },
    { keywords: ["yogurt", "curd", "dahi"], grams: 170 },
    { keywords: ["oatmeal", "oats"], grams: 40 },
    { keywords: ["rice cooked", "cooked rice"], grams: 150 },
    { keywords: ["rice"], grams: 80 },
    { keywords: ["pasta cooked", "cooked pasta"], grams: 140 },
    { keywords: ["pasta", "noodle"], grams: 85 },
    { keywords: ["potato", "sweet potato"], grams: 150 },
    { keywords: ["olive oil", "coconut oil", "oil"], grams: 15 },
    { keywords: ["butter", "ghee"], grams: 14 },
    { keywords: ["cheese slice", "slice of cheese"], grams: 28 },
    { keywords: ["cheese"], grams: 40 },
    { keywords: ["broccoli", "cauliflower", "spinach", "lettuce", "kale"], grams: 80 },
    { keywords: ["dal", "lentil", "beans cooked"], grams: 150 },
    { keywords: ["paneer"], grams: 100 },
    { keywords: ["idli"], grams: 50 },
    { keywords: ["dosa"], grams: 70 },
    { keywords: ["sandwich", "burger"], grams: 150 },
    { keywords: ["pizza slice"], grams: 100 },
    { keywords: ["pizza"], grams: 120 },
    { keywords: ["cookie", "biscuit"], grams: 15 },
    { keywords: ["protein bar", "energy bar"], grams: 60 },
    { keywords: ["coffee", "tea"], grams: 240 },
    { keywords: ["smoothie", "shake"], grams: 300 },
    { keywords: ["avocado"], grams: 100 },
    { keywords: ["toast"], grams: 30 },
  ];
  for (const { keywords, grams } of rules) {
    if (keywords.some((t) => lower.includes(t))) return grams;
  }
  return 100;
};

/** Unit to grams for volume measures (approximate) */
const UNIT_TO_GRAMS: Record<string, number> = {
  cup: 240, cups: 240,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  ml: 1, mls: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  oz: 30, floz: 30,
  piece: 50, pieces: 50, serving: 100, servings: 100,
  slice: 30, slices: 30
};

/**
 * Calculate similarity score between two strings (0-1, higher = more similar).
 * Uses a simple approach: checks word overlap and string containment.
 */
function calculateSimilarity(input: string, candidate: string): number {
  const inputWords = input.toLowerCase().split(/\s+/);
  const candidateWords = candidate.toLowerCase().split(/\s+/);
  
  // Exact match gets highest score
  if (input.toLowerCase() === candidate.toLowerCase()) return 1.0;
  
  // Check if input is contained in candidate or vice versa
  if (candidate.toLowerCase().includes(input.toLowerCase())) return 0.9;
  if (input.toLowerCase().includes(candidate.toLowerCase())) return 0.85;
  
  // Calculate word overlap
  const inputSet = new Set(inputWords);
  const candidateSet = new Set(candidateWords);
  let matchingWords = 0;
  inputSet.forEach(word => {
    if (candidateSet.has(word)) matchingWords++;
  });
  
  // Score based on proportion of matching words
  const overlapRatio = matchingWords / Math.max(inputWords.length, candidateWords.length);
  return overlapRatio * 0.8; // Cap at 0.8 for word-based matching
}

/**
 * Find best fuzzy match for a food name in known foods.
 * Returns the canonical name if similarity > threshold, otherwise null.
 */
function findFuzzyMatch(
  foodName: string,
  nameToCanonical: Map<string, string>,
  threshold: number = 0.7
): string | null {
  let bestMatch: string | null = null;
  let bestScore = threshold;
  
  // First try exact normalized match
  const normalizedInput = normalizeFoodNameForDedup(foodName);
  if (normalizedInput && nameToCanonical.has(normalizedInput)) {
    return nameToCanonical.get(normalizedInput) || null;
  }
  
  // Fuzzy search through all candidates
  for (const [normalizedKey, canonical] of nameToCanonical.entries()) {
    const score = calculateSimilarity(foodName, canonical);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = canonical;
    }
  }
  
  return bestMatch;
}

/**
 * Try to resolve food text from known foods + nutrients cache.
 * Returns MealItem[] if all lines can be resolved, null otherwise.
 */
function resolveFromKnownFoods(
  text: string,
  knownFoods: string[],
  foodNutrients: Record<string, NutrientTotals>
): MealItem[] | null {
  const lines = text.split(/[\n,]/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const nameToCanonical = new Map<string, string>();
  knownFoods.forEach((name) => {
    const key = normalizeFoodNameForDedup(name);
    if (key) nameToCanonical.set(key, name);
  });
  const items: MealItem[] = [];
  for (const line of lines) {
    const parsed = parseFoodLine(line, nameToCanonical, foodNutrients);
    if (!parsed) return null;
    items.push(parsed);
  }
  return items.length > 0 ? items : null;
}

/**
 * Local fallback parser when API is unavailable. Parses simple formats like
 * "100g chicken", "2 eggs", "oatmeal with berries" and returns estimated items.
 * Uses a minimal built-in nutrient table for common foods.
 */
const LOCAL_FOOD_ESTIMATES: Record<string, NutrientTotals> = {
  chicken: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sodium_mg: 74, cholesterol_mg: 85, omega_3_g: 0.1, omega_6_g: 0.6, potassium_mg: 256, calcium_mg: 15, iron_mg: 1.3, vitamin_d_iu: 5, vitamin_b12_ug: 0.3, magnesium_mg: 29, vitamin_c_mg: 0, vitamin_a_mcg: 9 },
  rice: { calories_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, sodium_mg: 1, cholesterol_mg: 0, omega_3_g: 0, omega_6_g: 0.09, potassium_mg: 35, calcium_mg: 10, iron_mg: 0.2, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 12, vitamin_c_mg: 0, vitamin_a_mcg: 0 },
  egg: { calories_kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, fiber_g: 0, sodium_mg: 124, cholesterol_mg: 373, omega_3_g: 0.1, omega_6_g: 1.4, potassium_mg: 126, calcium_mg: 50, iron_mg: 1.8, vitamin_d_iu: 87, vitamin_b12_ug: 0.9, magnesium_mg: 12, vitamin_c_mg: 0, vitamin_a_mcg: 160 },
  eggs: { calories_kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, fiber_g: 0, sodium_mg: 124, cholesterol_mg: 373, omega_3_g: 0.1, omega_6_g: 1.4, potassium_mg: 126, calcium_mg: 50, iron_mg: 1.8, vitamin_d_iu: 87, vitamin_b12_ug: 0.9, magnesium_mg: 12, vitamin_c_mg: 0, vitamin_a_mcg: 160 },
  oats: { calories_kcal: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, sodium_mg: 2, cholesterol_mg: 0, omega_3_g: 0.11, omega_6_g: 2.42, potassium_mg: 429, calcium_mg: 54, iron_mg: 4.7, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 177, vitamin_c_mg: 0, vitamin_a_mcg: 0 },
  oatmeal: { calories_kcal: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, sodium_mg: 2, cholesterol_mg: 0, omega_3_g: 0.11, omega_6_g: 2.42, potassium_mg: 429, calcium_mg: 54, iron_mg: 4.7, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 177, vitamin_c_mg: 0, vitamin_a_mcg: 0 },
  bread: { calories_kcal: 265, protein_g: 9, carbs_g: 49, fat_g: 3.2, fiber_g: 2.7, sodium_mg: 491, cholesterol_mg: 0, omega_3_g: 0.02, omega_6_g: 0.54, potassium_mg: 115, calcium_mg: 260, iron_mg: 3.6, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 25, vitamin_c_mg: 0, vitamin_a_mcg: 0 },
  banana: { calories_kcal: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3, fiber_g: 2.6, sodium_mg: 1, cholesterol_mg: 0, omega_3_g: 0.03, omega_6_g: 0.05, potassium_mg: 358, calcium_mg: 5, iron_mg: 0.3, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 27, vitamin_c_mg: 8.7, vitamin_a_mcg: 3 },
  apple: { calories_kcal: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2, fiber_g: 2.4, sodium_mg: 1, cholesterol_mg: 0, omega_3_g: 0.01, omega_6_g: 0.04, potassium_mg: 107, calcium_mg: 6, iron_mg: 0.1, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 5, vitamin_c_mg: 4.6, vitamin_a_mcg: 2 },
  milk: { calories_kcal: 50, protein_g: 3.4, carbs_g: 4.8, fat_g: 1.5, fiber_g: 0, sodium_mg: 44, cholesterol_mg: 5, omega_3_g: 0.04, omega_6_g: 0.05, potassium_mg: 150, calcium_mg: 120, iron_mg: 0, vitamin_d_iu: 40, vitamin_b12_ug: 0.4, magnesium_mg: 11, vitamin_c_mg: 0, vitamin_a_mcg: 46 },
  yogurt: { calories_kcal: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.4, fiber_g: 0, sodium_mg: 36, cholesterol_mg: 5, omega_3_g: 0.02, omega_6_g: 0.02, potassium_mg: 141, calcium_mg: 110, iron_mg: 0.1, vitamin_d_iu: 0, vitamin_b12_ug: 0.4, magnesium_mg: 11, vitamin_c_mg: 0, vitamin_a_mcg: 27 },
  salad: { calories_kcal: 15, protein_g: 1.2, carbs_g: 2.9, fat_g: 0.2, fiber_g: 1.2, sodium_mg: 28, cholesterol_mg: 0, omega_3_g: 0.01, omega_6_g: 0.04, potassium_mg: 194, calcium_mg: 36, iron_mg: 0.9, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 13, vitamin_c_mg: 9.2, vitamin_a_mcg: 469 },
  coffee: { calories_kcal: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 5, cholesterol_mg: 0, omega_3_g: 0, omega_6_g: 0, potassium_mg: 116, calcium_mg: 5, iron_mg: 0, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 7, vitamin_c_mg: 0, vitamin_a_mcg: 0 },
  pasta: { calories_kcal: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1, fiber_g: 1.8, sodium_mg: 1, cholesterol_mg: 0, omega_3_g: 0.01, omega_6_g: 0.2, potassium_mg: 24, calcium_mg: 7, iron_mg: 1.3, vitamin_d_iu: 0, vitamin_b12_ug: 0, magnesium_mg: 18, vitamin_c_mg: 0, vitamin_a_mcg: 0 },
};
const GENERIC_FOOD: NutrientTotals = { calories_kcal: 150, protein_g: 10, carbs_g: 15, fat_g: 8, fiber_g: 2, sodium_mg: 200, cholesterol_mg: 30, omega_3_g: 0.1, omega_6_g: 0.5, potassium_mg: 200, calcium_mg: 30, iron_mg: 1, vitamin_d_iu: 10, vitamin_b12_ug: 0.2, magnesium_mg: 20, vitamin_c_mg: 5, vitamin_a_mcg: 50 };

function findLocalFoodEstimate(foodPart: string): NutrientTotals {
  const normalized = foodPart.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const words = normalized.split(/\s+/);
  for (const w of words) {
    if (w.length >= 3 && LOCAL_FOOD_ESTIMATES[w]) {
      return LOCAL_FOOD_ESTIMATES[w];
    }
  }
  if (LOCAL_FOOD_ESTIMATES[normalized]) return LOCAL_FOOD_ESTIMATES[normalized];
  return GENERIC_FOOD;
}

// --- Smarter local parser: identify foods + apply portion heuristics ---

const BREAD_LIKE_KEYWORDS = ["parantha", "paratha", "chapati", "roti", "naan", "bread", "pav", "bun"];

const DEFAULT_GRAMS_PER_PIECE: Record<string, number> = {
  "plain parantha": 60,
  parantha: 60,
  paratha: 60,
  chapati: 40,
  roti: 40,
  naan: 90,
  bread: 30,
  pav: 35,
  bun: 40,
  "*": 50,
};

const DEFAULT_OIL_PER_PIECE_G = 8;
const DEFAULT_OIL_PER_SERVING_G = 10;

const OIL_PER_GRAM_RATIO = 0.18; // 18% of main grams as oil for gram-based mains
const MIN_OIL_G = 5;
const MAX_OIL_G = 40;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function detectFoodRole(name: string): ParsedFoodRole {
  const lower = name.toLowerCase();
  if (/\b(oil|ghee|butter|olive oil|avocado oil)\b/.test(lower)) return "cooking-fat";
  if (/\b(sauce|ketchup|mayo|mayonnaise|chutney|dressing)\b/.test(lower)) return "sauce";
  if (/\b(coffee|tea|juice|latte|cappuccino|milk|smoothie)\b/.test(lower)) return "beverage";
  return "main";
}

function isBreadLike(name: string): boolean {
  const lower = name.toLowerCase();
  return BREAD_LIKE_KEYWORDS.some((k) => lower.includes(k));
}

function parseToParsedFoods(text: string): ParsedFood[] {
  const chunks = text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: ParsedFood[] = [];

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();

    // Special case: "<grams> g <main> in <fat>"
    const gramInMatch = lower.match(
      /^(\d+(?:\.\d+)?)\s*g\s+(.+?)\s+in\s+(.+)$/
    );
    if (gramInMatch) {
      const grams = parseFloat(gramInMatch[1]);
      const mainText = gramInMatch[2].trim();
      const fatText = gramInMatch[3].trim();

      const mainName = capitalizeFirst(mainText);
      const fatName = capitalizeFirst(fatText);

      results.push({
        name: mainName,
        originalText: chunk,
        quantity: Number.isFinite(grams) ? grams : undefined,
        unit: "g",
        approx: !Number.isFinite(grams),
        role: "main",
        confidence: 0.95,
      });

      results.push({
        name: fatName,
        originalText: chunk,
        quantity: undefined,
        unit: undefined,
        approx: true,
        role: detectFoodRole(fatName),
        confidence: 0.8,
        notes: "Cooking fat inferred from 'in ... oil'",
      });
      continue;
    }

    // Special case: "<num> <main> in <fat>"
    const inMatch = lower.match(
      /^(\d+(?:\.\d+)?)\s+(.+?)\s+in\s+(.+)$/
    );
    if (inMatch) {
      const qty = parseFloat(inMatch[1]);
      const mainText = inMatch[2].trim();
      const fatText = inMatch[3].trim();

      const mainName = capitalizeFirst(mainText);
      const fatName = capitalizeFirst(fatText);

      results.push({
        name: mainName,
        originalText: chunk,
        quantity: Number.isFinite(qty) ? qty : undefined,
        unit: "piece",
        approx: !Number.isFinite(qty),
        role: "main",
        confidence: 0.9,
      });

      results.push({
        name: fatName,
        originalText: chunk,
        quantity: undefined,
        unit: undefined,
        approx: true,
        role: detectFoodRole(fatName),
        confidence: 0.7,
        notes: "Cooking fat inferred from 'in ... oil'",
      });
      continue;
    }

    // Check for patterns with unit words: "<num> <unit> <food>" or "<food> <num> <unit>"
    // Units: packet, packets, pc, pcs, piece, pieces
    const unitWords = ["packet", "packets", "pc", "pcs", "piece", "pieces"];
    let numUnitMatch = null;
    let hasUnit = false;
    let num = NaN;
    let foodPart = "";
    
    // Try "<num> <unit> <food>" first
    const numUnitFoodMatch = lower.match(
      /^(\d+(?:\.\d+)?)\s+(packet|packets|pc|pcs|piece|pieces)\s+(.+)$/
    );
    if (numUnitFoodMatch) {
      num = parseFloat(numUnitFoodMatch[1]);
      hasUnit = unitWords.includes(numUnitFoodMatch[2]);
      foodPart = numUnitFoodMatch[3].trim();
    } else {
      // Try "<food> <num> <unit>"
      const foodNumUnitMatch = lower.match(
        /^(.+?)\s+(\d+(?:\.\d+)?)\s+(packet|packets|pc|pcs|piece|pieces)\s*$/
      );
      if (foodNumUnitMatch) {
        num = parseFloat(foodNumUnitMatch[2]);
        hasUnit = unitWords.includes(foodNumUnitMatch[3]);
        foodPart = foodNumUnitMatch[1].trim();
      } else {
        // Try "<num> <food>" or "<food> <num>" (no unit)
        const numMatch = lower.match(
          /^(\d+(?:\.\d+)?)\s+(.+)$|^(.+?)\s+(\d+(?:\.\d+)?)\s*$/
        );
        if (numMatch) {
          num = parseFloat(numMatch[1] || numMatch[4]);
          foodPart = (numMatch[2] || numMatch[3] || "").trim();
        }
      }
    }
    
    if (!Number.isNaN(num) && foodPart) {
      const name = capitalizeFirst(foodPart);
      results.push({
        name,
        originalText: chunk,
        quantity: Number.isFinite(num) ? num : undefined,
        unit: hasUnit ? "piece" : undefined,
        approx: !Number.isFinite(num),
        role: detectFoodRole(name),
        confidence: hasUnit ? 0.85 : 0.8,
      });
      continue;
    }

    // Fallback: treat entire chunk as a single food with unknown quantity
    const name = capitalizeFirst(chunk);
    results.push({
      name,
      originalText: chunk,
      quantity: undefined,
      unit: undefined,
      approx: true,
      role: detectFoodRole(name),
      confidence: 0.6,
    });
  }

  return results;
}

function enrichParsedFoods(parsedFoods: ParsedFood[]): MealItem[] {
  if (parsedFoods.length === 0) return [];

  // Estimate total mains as pieces and grams for oil heuristics
  let totalMainPieces = 0;
  let totalMainGrams = 0;

  for (const f of parsedFoods) {
    if (f.role !== "main") continue;
    const lowerName = f.name.toLowerCase();
    const qty = f.quantity && f.quantity > 0 ? f.quantity : undefined;

    if (isBreadLike(lowerName) || (f.unit === "piece" && qty)) {
      const pieces = qty ?? 1;
      const key = Object.keys(DEFAULT_GRAMS_PER_PIECE).find(
        (k) => k !== "*" && lowerName.includes(k)
      );
      const perPiece =
        (key && DEFAULT_GRAMS_PER_PIECE[key]) || DEFAULT_GRAMS_PER_PIECE["*"];
      totalMainPieces += pieces;
      totalMainGrams += perPiece * pieces;
    } else if (f.unit === "g" && qty) {
      totalMainGrams += qty;
    }
  }

  const items: MealItem[] = [];

  for (const f of parsedFoods) {
    const lowerName = f.name.toLowerCase();
    let grams = 0;
    let quantity = f.quantity;
    let unit: string | undefined = f.unit;
    let approx = !!f.approx;

    if (f.role === "main") {
      if (isBreadLike(lowerName) || (quantity && quantity > 0 && (unit === "piece" || !unit))) {
        const pieces = quantity && quantity > 0 ? quantity : 1;
        const key = Object.keys(DEFAULT_GRAMS_PER_PIECE).find(
          (k) => k !== "*" && lowerName.includes(k)
        );
        let perPiece = key && DEFAULT_GRAMS_PER_PIECE[key];
        // If no specific per-piece weight found, use inferDefaultServingGrams for better estimation
        if (!perPiece) {
          perPiece = inferDefaultServingGrams(f.name);
        }
        grams = perPiece * pieces;
        quantity = pieces;
        unit = "piece";
        approx = approx || !f.quantity;
      } else if (unit === "g" && quantity && quantity > 0) {
        // Explicit gram-based main, e.g. "150g chicken"
        grams = quantity;
        approx = approx || false;
      } else {
        // Fallback main: use inferDefaultServingGrams for better estimation
        grams = inferDefaultServingGrams(f.name);
        quantity = grams;
        unit = "g";
        approx = true;
      }
    } else if (f.role === "cooking-fat") {
      if (totalMainPieces > 0) {
        // Piece-based mains (e.g. paranthas with oil)
        grams = totalMainPieces * DEFAULT_OIL_PER_PIECE_G;
      } else if (totalMainGrams > 0) {
        // Gram-based mains (e.g. "150g chicken ... in oil")
        grams = clamp(totalMainGrams * OIL_PER_GRAM_RATIO, MIN_OIL_G, MAX_OIL_G);
      } else {
        // No clear main context: single-serving default
        grams = DEFAULT_OIL_PER_SERVING_G;
      }
      quantity = grams;
      unit = "g";
      approx = true;
    } else {
      // Generic fallback: 100g serving
      grams = 100;
      quantity = 100;
      unit = "g";
      approx = true;
    }

    const nutrientsBase = findLocalFoodEstimate(f.name);
    const scale = grams / 100;
    const nutrients = scaleTotals(nutrientsBase, scale);

    items.push({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: f.name,
      quantity: quantity || grams,
      unit: unit || "g",
      grams,
      nutrients,
    });
  }

  return items;
}

function parseFoodTextLocally(text: string): MealItem[] {
  const parsed = parseToParsedFoods(text);
  return enrichParsedFoods(parsed);
}

function parseFoodLine(
  line: string,
  nameToCanonical: Map<string, string>,
  foodNutrients: Record<string, NutrientTotals>
): MealItem | null {
  const lower = line.trim().toLowerCase();
  if (!lower) return null;
  let grams = 0;
  let unit = "g";
  let foodPart = lower;
  // Match "50g oatmeal" or "oatmeal 50g" or "50 g oatmeal" or "oatmeal 50 g"
  const gMatch = lower.match(/^(\d+(?:\.\d+)?)\s*g\s+(.+)$|^(.+?)\s+(\d+(?:\.\d+)?)\s*g\s*$/i);
  if (gMatch) {
    const num = parseFloat(gMatch[1] || gMatch[4]);
    foodPart = (gMatch[2] || gMatch[3] || "").trim();
    if (foodPart && !Number.isNaN(num) && num > 0) {
      grams = num;
      unit = "g";
    }
  } else {
    const mlMatch = lower.match(/^(\d+(?:\.\d+)?)\s*ml\s+(.+)$|^(.+?)\s+(\d+(?:\.\d+)?)\s*ml\s*$/i);
    if (mlMatch) {
      const num = parseFloat(mlMatch[1] || mlMatch[4]);
      foodPart = (mlMatch[2] || mlMatch[3] || "").trim();
      if (foodPart && !Number.isNaN(num) && num > 0) {
        grams = num;
        unit = "ml";
      }
    } else {
      const numUnitMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(\w+)\s+(.+)$|^(.+?)\s+(\d+(?:\.\d+)?)\s*(\w+)\s*$/i);
      if (numUnitMatch) {
        const num = parseFloat(numUnitMatch[1] || numUnitMatch[5]);
        const u = (numUnitMatch[2] || numUnitMatch[6] || "").toLowerCase();
        foodPart = (numUnitMatch[3] || numUnitMatch[4] || "").trim();
        const conv = UNIT_TO_GRAMS[u];
        if (foodPart && !Number.isNaN(num) && num > 0 && conv !== undefined) {
          grams = num * conv;
          unit = u;
        }
      } else {
        const numOnlyMatch = lower.match(/^(\d+(?:\.\d+)?)\s+(.+)$|^(.+?)\s+(\d+(?:\.\d+)?)\s*$/);
        if (numOnlyMatch) {
          const num = parseFloat(numOnlyMatch[1] || numOnlyMatch[4]);
          foodPart = (numOnlyMatch[2] || numOnlyMatch[3] || "").trim();
          if (foodPart && !Number.isNaN(num) && num > 0) {
            if (num < 10) {
              grams = num * 50;
              unit = num === 1 ? "piece" : "pieces";
            } else {
              grams = num;
              unit = "g";
            }
          }
        }
      }
    }
  }
  // If no explicit quantity was parsed, choose a reasonable default.
  // For supplements (tablet, capsule, pill), assume ~1 piece instead of 100 g.
  if (!grams || grams <= 0) {
    const isSupplement = /\b(tablet|tab|capsule|caps|pill|softgel)\b/i.test(foodPart);
    if (isSupplement) {
      grams = 1;
      unit = "piece";
    } else {
      grams = 100;
      unit = "g";
    }
  }

  // Try exact match first
  let normalizedKey = normalizeFoodNameForDedup(foodPart);
  let canonical = normalizedKey ? nameToCanonical.get(normalizedKey) : null;
  
  // If no exact match, try fuzzy matching
  if (!canonical) {
    canonical = findFuzzyMatch(foodPart, nameToCanonical, 0.7);
    if (canonical) {
      normalizedKey = normalizeFoodNameForDedup(canonical);
    }
  }
  
  if (!canonical || !normalizedKey) return null;
  const nutrientsPer100g = foodNutrients[normalizedKey];
  if (!nutrientsPer100g) return null;
  const scale = grams / 100;
  const nutrients = scaleTotals(nutrientsPer100g, scale);
  const quantity = unit === "g" || unit === "ml" ? grams : Math.round(grams / (UNIT_TO_GRAMS[unit] ?? 100));
  return {
    id: `cache-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: canonical,
    quantity,
    unit,
    grams,
    nutrients
  };
}

/** Fixed spacing between top header and content on all screens */
const HEADER_TO_CONTENT_GAP = 18;

const defaultProfile: UserProfile = {
  dateOfBirth: null,
  genderAtBirth: null,
  heightCm: null,
  heightUnit: "cm",
  weightKg: null,
  goal: null,
  activityLevel: null
};

const getAgeFromDOB = (dob: string | null): number | null => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getMacroTargets = (profile: UserProfile) => {
  // Calculate BMR using Mifflin-St Jeor Equation
  const calculateBMR = (weightKg: number, heightCm: number, age: number, isMale: boolean): number => {
    if (isMale) {
      return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
  };

  // Activity multipliers: use mid-range, not upper end (so targets aren't at the high end)
  const activityMultipliers = {
    low: 1.1,      // mid of sedentary range (1.0–1.2)
    medium: 1.4,   // mid of moderately active (1.3–1.55)
    high: 1.6     // mid of very active (1.55–1.725)
  };

  // Default values if profile incomplete
  const age = profile.dateOfBirth ? getAgeFromDOB(profile.dateOfBirth) : 44;
  const weightKg = profile.weightKg ?? 73;
  const heightCm = profile.heightCm ?? 175;
  const isMale = profile.genderAtBirth === "male";
  const activityLevel = profile.activityLevel ?? "medium";
  const multiplier = activityMultipliers[activityLevel] ?? 1.4;

  if (age && weightKg && heightCm) {
    const bmr = calculateBMR(weightKg, heightCm, age, isMale);
    let tdee = bmr * multiplier;

    // Adjust calories based on goal
    if (profile.goal === "weight_loss") {
      tdee = tdee * 0.85; // 15% deficit
    } else if (profile.goal === "weight_gain") {
      tdee = tdee * 1.15; // 15% surplus
    } else if (profile.goal === "muscle_gain") {
      tdee = tdee * 1.1; // 10% surplus
    } else if (
      profile.goal === "maintain_weight" ||
      profile.goal === "reduce_cholesterol" ||
      profile.goal === "reduce_cholesterol_maintain_weight"
    ) {
      // Use the middle of the recommended range instead of the upper end
      // Slight 10% reduction keeps calories on the lower / mid side
      tdee = tdee * 0.9;
    }

    // Round calories to the nearest 100 (e.g. 2297 → 2300)
    const calories = Math.round(tdee / 100) * 100;

    // Protein: use slightly lower target for maintenance / health‑focused goals,
    // higher for muscle gain or weight loss.
    let proteinPerKg: number;
    if (profile.goal === "muscle_gain") {
      proteinPerKg = 2.0;          // higher end for building muscle
    } else if (profile.goal === "weight_loss") {
      proteinPerKg = 1.6;          // support satiety and lean mass
    } else {
      // maintain_weight, reduce_cholesterol, reduce_cholesterol_maintain_weight,
      // heart_health, diabetes_management, or unspecified
      proteinPerKg = 1.3;          // mid‑range, not the high end
    }

    let protein_g = weightKg * proteinPerKg;
    let fat_g = calories * 0.25 / 9; // 25% of calories from fat
    let carbs_g = (calories - (protein_g * 4) - (fat_g * 9)) / 4;

    // Round macros to practical numbers (nearest 5 g)
    const roundTo5 = (x: number) => Math.max(0, Math.round(x / 5) * 5);
    protein_g = roundTo5(protein_g);
    fat_g = roundTo5(fat_g);
    carbs_g = roundTo5(carbs_g);

    return {
      calories_kcal: calories,
      protein_g: protein_g,
      carbs_g: carbs_g,
      fat_g: fat_g
    };
  }

  // Fallback to defaults
  return {
    calories_kcal: 2400,
    protein_g: 80,
    carbs_g: 100,
    fat_g: 80
  };
};

// nutritionSummary and macroNutrients are now computed dynamically based on userProfile

const STORAGE_KEY = "@mealtracking_dataByDate";
const PROFILE_STORAGE_KEY = "@mealtracking_userProfile";
const YESTERDAY_INSIGHT_DISMISSED_KEY = "@mealtracking_yesterdayInsightDismissed";
const FOOD_SUGGESTIONS_KEY = "@mealtracking_foodSuggestions";
const FOOD_NUTRIENTS_KEY = "@mealtracking_foodNutrients";
const FOOD_OVERRIDES_KEY = "@mealtracking_foodOverrides";
const FOOD_SERVING_GRAMS_KEY = "@mealtracking_foodServingGrams";
const MEAL_TEMPLATES_KEY = "@mealtracking_mealTemplates";

type MealTemplate = {
  id: string;
  name: string;
  items: string[]; // Array of food item names
};

// Estimate Vitamin C and A based on item name (for migration of existing data)
const estimateVitaminsFromName = (
  name: string,
  grams: number
): { vitamin_c_mg: number; vitamin_a_mcg: number } => {
  const lower = name.toLowerCase();
  let vitamin_c_mg = 0;
  let vitamin_a_mcg = 0;

  // Check for supplements first (these are per-item, not per-100g)
  if (
    lower.includes("vitamin c") ||
    lower.includes("vit c") ||
    lower.includes("ascorbic acid")
  ) {
    // Typical vitamin C supplement: 500-1000mg per tablet
    // Use quantity if available, otherwise estimate ~500mg per tablet
    vitamin_c_mg = grams > 0 && grams < 10 ? 500 : 1000; // If grams < 10, likely a tablet
  } else if (
    lower.includes("vitamin a") ||
    lower.includes("vit a") ||
    lower.includes("retinol")
  ) {
    // Typical vitamin A supplement: 900mcg RAE per tablet
    vitamin_a_mcg = grams > 0 && grams < 10 ? 900 : 1800;
  } else {
    // Food items: use per-100g estimates
    const factor = grams / 100;

    // Vitamin C estimates (mg per 100g)
    let vitCPer100g = 0;
    if (
      lower.includes("orange") ||
      lower.includes("lemon") ||
      lower.includes("lime") ||
      lower.includes("grapefruit")
    ) {
      vitCPer100g = 53; // Citrus fruits
    } else if (lower.includes("strawberry") || lower.includes("kiwi")) {
      vitCPer100g = 59;
    } else if (lower.includes("broccoli") || lower.includes("brussels")) {
      vitCPer100g = 89;
    } else if (lower.includes("bell pepper") || lower.includes("pepper")) {
      vitCPer100g = 80;
    } else if (lower.includes("tomato")) {
      vitCPer100g = 14;
    } else if (lower.includes("spinach") || lower.includes("kale")) {
      vitCPer100g = 28;
    } else if (lower.includes("berry") || lower.includes("blueberry")) {
      vitCPer100g = 9.7;
    }

    // Vitamin A estimates (mcg per 100g)
    let vitAPer100g = 0;
    if (lower.includes("carrot")) {
      vitAPer100g = 835;
    } else if (lower.includes("sweet potato")) {
      vitAPer100g = 709;
    } else if (lower.includes("spinach") || lower.includes("kale")) {
      vitAPer100g = 469;
    } else if (lower.includes("broccoli")) {
      vitAPer100g = 31;
    } else if (lower.includes("milk") || lower.includes("cheese")) {
      vitAPer100g = 46;
    } else if (lower.includes("egg")) {
      vitAPer100g = 160;
    } else if (lower.includes("liver")) {
      vitAPer100g = 8367; // Very high
    }

    vitamin_c_mg = vitCPer100g * factor;
    vitamin_a_mcg = vitAPer100g * factor;
  }

  return { vitamin_c_mg, vitamin_a_mcg };
};

// Migrate existing data to include vitamin_c_mg and vitamin_a_mcg
const migrateDataForVitamins = (data: Record<string, DayData>): Record<string, DayData> => {
  const migrated: Record<string, DayData> = {};
  let hasChanges = false;

  for (const [dateKey, dayData] of Object.entries(data)) {
    const migratedMealItems: Record<string, MealItem[]> = {};
    let dayHasChanges = false;

    for (const [mealId, items] of Object.entries(dayData.mealItems)) {
      const migratedItems = items.map((item) => {
        const nutrients = item.nutrients as Record<string, number>;
        const needsMigration =
          nutrients.vitamin_c_mg === undefined ||
          nutrients.vitamin_a_mcg === undefined;

        if (needsMigration) {
          dayHasChanges = true;
          const estimates = estimateVitaminsFromName(item.name, item.grams || 100);
          return {
            ...item,
            nutrients: {
              ...nutrients,
              vitamin_c_mg: nutrients.vitamin_c_mg ?? estimates.vitamin_c_mg,
              vitamin_a_mcg: nutrients.vitamin_a_mcg ?? estimates.vitamin_a_mcg
            } as NutrientTotals
          };
        }
        return item;
      });
      migratedMealItems[mealId] = migratedItems;
    }

    if (dayHasChanges) {
      hasChanges = true;
      // Recalculate meal nutrients from items
      const migratedMeals = dayData.meals.map((meal) => {
        const items = migratedMealItems[meal.id] || [];
        const mealNutrients = items.reduce(
          (acc, item) => sumTotals(acc, item.nutrients),
          emptyTotals()
        );
        return { ...meal, nutrients: mealNutrients };
      });
      migrated[dateKey] = {
        meals: migratedMeals,
        mealItems: migratedMealItems
      };
    } else {
      migrated[dateKey] = dayData;
    }
  }

  return hasChanges ? migrated : data;
};

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (dateKey: string, delta: number): string => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const d2 = new Date(y, m - 1, d + delta);
  return toDateKey(d2);
};

const formatHeaderLabel = (dateKey: string): string => {
  const today = toDateKey(new Date());
  if (dateKey === today) return "Today";
  const yesterday = addDays(today, -1);
  if (dateKey === yesterday) return "Yesterday";
  const [y, m, day] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  const mon = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const jan = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${mon}, ${jan} ${d.getDate()}`;
};

const INSIGHT_TIP_BAR_COLORS = { positive: "#00C853", improvement: "#FF9800" } as const;

/** Renders a tip with a colored vertical bar (green = positive, orange = improvement) and bold first phrase. */
const renderInsightTip = (tip: InsightTip, key: number, itemStyle: object) => {
  const { text, type } = tip;
  const barColor = INSIGHT_TIP_BAR_COLORS[type];
  const emDash = text.indexOf("—");
  const spaceHyphen = text.indexOf(" - ");
  let splitAt = -1;
  let sepLen = 0;
  if (emDash >= 0 && (spaceHyphen < 0 || emDash < spaceHyphen)) {
    splitAt = emDash;
    sepLen = 1;
  } else if (spaceHyphen >= 0) {
    splitAt = spaceHyphen;
    sepLen = 3;
  }
  const beforeHyphen = splitAt >= 0 ? text.slice(0, splitAt).trim() : "";
  const afterHyphen = splitAt >= 0 ? text.slice(splitAt + sepLen).trim() : "";
  const separator = sepLen === 1 ? "— " : " - ";
  const textContent = splitAt < 0
    ? <Text style={itemStyle} selectable>{text}</Text>
    : (
        <Text style={itemStyle} selectable>
          <Text style={[itemStyle, { fontWeight: "bold" }]} selectable>{beforeHyphen}</Text>
          {afterHyphen ? separator + afterHyphen : ""}
        </Text>
      );
  return (
    <View key={key} style={styles.insightsTipRow}>
      <View style={[styles.insightsTipBar, { backgroundColor: barColor }]} />
      <View style={styles.insightsTipTextWrap}>
        {textContent}
      </View>
    </View>
  );
};

type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  nutrients: NutrientTotals;
};

type DayData = {
  meals: MealState[];
  mealItems: Record<string, MealItem[]>;
};

const initialMeals: MealState[] = [
  { id: "breakfast", label: "Breakfast", nutrients: emptyTotals() },
  { id: "lunch", label: "Lunch", nutrients: emptyTotals() },
  { id: "snack-afternoon", label: "Afternoon Snack", nutrients: emptyTotals() },
  { id: "dinner", label: "Dinner", nutrients: emptyTotals() },
  { id: "snack-evening", label: "Evening Snack", nutrients: emptyTotals() }
];

const getDefaultDayData = (): DayData => ({
  meals: initialMeals.map((m) => ({ ...m, nutrients: emptyTotals() })),
  mealItems: {}
});

// Meal icons - colored for non-empty, grayscale for empty
const MEAL_ICON_COLORED = require("./assets/meal-icon-colored.png");
const MEAL_ICON_GRAYSCALE = require("./assets/meal-icon-grayscale.png");

// Loading screen SVG - will be loaded from file
type TabId = "meals" | "analysis" | "insights";

// ANALYSIS_MACROS is now computed dynamically based on userProfile

type MicroKey =
  | "fiber_g"
  | "sodium_mg"
  | "cholesterol_mg"
  | "omega_3_g"
  | "potassium_mg"
  | "vitamin_d_iu"
  | "magnesium_mg"
  | "vitamin_c_mg"
  | "vitamin_a_mcg";

const ANALYSIS_MICROS: {
  label: string;
  unit: string;
  target: number;
  key?: MicroKey;
}[] = [
  { label: "Fiber", unit: "g", target: 25, key: "fiber_g" },
  { label: "Vitamin C", unit: "mg", target: 90, key: "vitamin_c_mg" },
  { label: "Vitamin A", unit: "mcg", target: 900, key: "vitamin_a_mcg" },
  { label: "Omega 3", unit: "mg", target: 500, key: "omega_3_g" },
  { label: "Cholesterol", unit: "mg", target: 300, key: "cholesterol_mg" },
  { label: "Vitamin D", unit: "IU", target: 800, key: "vitamin_d_iu" },
  { label: "Magnesium", unit: "mg", target: 400, key: "magnesium_mg" },
  { label: "Sodium", unit: "mg", target: 2300, key: "sodium_mg" },
  { label: "Potassium", unit: "mg", target: 2600, key: "potassium_mg" }
];

type SelectedNutrient =
  | {
      type: "macro";
      key: "protein_g" | "carbs_g" | "fat_g";
      label: string;
      unit: string;
      target: number;
    }
  | {
      type: "micro";
      label: string;
      unit: string;
      target: number;
      key?: MicroKey;
    };

const NUTRIENT_EXPLANATIONS: Record<string, string> = {
  Protein:
    "Protein supports muscle repair and daily function; target is based on your body weight.",
  Carbs:
    "Carbs provide energy for your body and brain; target is based on your activity and goals.",
  Fat:
    "Fat supports hormone health and absorbs vitamins; target is based on your goals.",
  Fiber:
    "Fiber aids digestion and heart health; aim for 25–30g daily from whole grains, fruits, and veggies.",
  "Vitamin C":
    "Vitamin C supports immunity and skin health; aim for 90mg daily from citrus, berries, and greens.",
  "Vitamin A":
    "Vitamin A supports vision and immune function; aim for 900mcg daily from leafy greens and orange veggies.",
  "Omega 3":
    "Omega-3 supports heart and brain health; aim for 500mg+ daily from fish, flax, or walnuts.",
  Cholesterol:
    "Dietary cholesterol; limit to about 300mg daily if managing blood cholesterol.",
  "Vitamin D":
    "Vitamin D supports bones and immunity; aim for 800IU daily; sun and fortified foods help.",
  Magnesium:
    "Magnesium supports muscle and nerve function; aim for 400mg daily from nuts, greens, and whole grains.",
  Sodium:
    "Sodium helps fluid balance; limit to 2300mg daily; most comes from packaged and restaurant foods.",
  Potassium:
    "Potassium supports heart and muscle function; aim for 2600mg daily from bananas, potatoes, and beans."
};

const MICRO_KEYS: MicroKey[] = [
  "fiber_g",
  "sodium_mg",
  "cholesterol_mg",
  "omega_3_g",
  "potassium_mg",
  "vitamin_d_iu",
  "magnesium_mg",
  "vitamin_c_mg",
  "vitamin_a_mcg"
];

function getMicroTotalsFromItems(
  items: Record<string, MealItem[]>
): Record<MicroKey, number> {
  const out = {} as Record<MicroKey, number>;
  for (const k of MICRO_KEYS) out[k] = 0;
  for (const mealId of Object.keys(items)) {
    const list = items[mealId] ?? [];
    for (const item of list) {
      const n = item.nutrients as Record<string, number>;
      for (const k of MICRO_KEYS) out[k] += n[k] ?? 0;
    }
  }
  return out;
}

/**
 * Convert stored micro value to display unit for UI/target comparison.
 * Only omega_3_g is stored in g but displayed in mg; all others use same unit.
 */
function microDisplayValue(key: MicroKey | undefined, value: number, unit: string): number {
  if (!key) return value;
  switch (key) {
    case "omega_3_g":
      return unit === "mg" ? value * 1000 : value;
    case "fiber_g":
    case "sodium_mg":
    case "cholesterol_mg":
    case "potassium_mg":
    case "vitamin_d_iu":
    case "magnesium_mg":
    case "vitamin_c_mg":
    case "vitamin_a_mcg":
    default:
      return value;
  }
}

function dayHasMeals(dayData: DayData): boolean {
  const { meals, mealItems } = dayData;
  for (const meal of meals) {
    if (meal.nutrients.calories_kcal > 0) return true;
    const items = mealItems[meal.id] ?? [];
    if (items.length > 0) return true;
  }
  return false;
}

function getPastDatesWithMeals(
  dataByDate: Record<string, DayData>,
  todayKey: string
): string[] {
  const out: string[] = [];
  for (const dateKey of Object.keys(dataByDate)) {
    if (dateKey >= todayKey) continue;
    const d = dataByDate[dateKey];
    if (d && dayHasMeals(d)) out.push(dateKey);
  }
  out.sort((a, b) => b.localeCompare(a));
  return out;
}

type InsightTip = { text: string; type: "positive" | "improvement" };
type InsightResult = { summary: string; tips: InsightTip[] };

function getDayInsights(
  dayData: DayData,
  userProfile: UserProfile
): InsightResult {
  const { meals, mealItems } = dayData;
  const totals = meals.reduce((acc, m) => sumTotals(acc, m.nutrients), emptyTotals());
  const microTotals = getMicroTotalsFromItems(mealItems);
  const targets = getMacroTargets(userProfile);
  const mealsLogged: string[] = [];
  for (const meal of meals) {
    const items = mealItems[meal.id] ?? [];
    if (items.length > 0 || meal.nutrients.calories_kcal > 0) {
      mealsLogged.push(meal.label);
    }
  }
  const fiber = microTotals.fiber_g ?? 0;
  const sodium = microTotals.sodium_mg ?? 0;
  const omega3Mg = (microTotals.omega_3_g ?? 0) * 1000;

  // Build concise, high-level summary (no detailed numbers, date-agnostic)
  let summary = "";
  if (mealsLogged.length > 0) {
    summary = `You logged ${mealsLogged.length} meal${mealsLogged.length !== 1 ? "s" : ""} (${mealsLogged.join(", ")}).`;
  } else {
    summary = "You started tracking—nice first step.";
  }

  // Add qualitative assessment without repeating exact numbers
  if (targets.calories_kcal > 0 && totals.calories_kcal > 0) {
    const calRatio = totals.calories_kcal / targets.calories_kcal;
    if (calRatio >= 0.85 && calRatio <= 1.15) {
      summary += " Your overall calories were close to your daily target—great balance.";
    } else if (calRatio > 1.15) {
      summary += " Calories were a bit above your usual target.";
    } else {
      summary += " Calories were somewhat below your usual target.";
    }
  }

  if (targets.protein_g > 0 && totals.protein_g > 0) {
    const proteinRatio = totals.protein_g / targets.protein_g;
    if (proteinRatio >= 0.9) {
      summary += " Protein intake was strong for supporting your goals.";
    } else if (proteinRatio >= 0.6) {
      summary += " Protein was decent but could be a bit higher.";
    }
  }

  // Tips with positive reinforcement (green) and constructive suggestions (orange)
  const tips: InsightTip[] = [];

  // Always start with positive reinforcement
  tips.push({ text: "Great job logging your meals—this kind of consistency really helps long-term progress.", type: "positive" });

  // Protein tips
  if (targets.protein_g > 0 && totals.protein_g > 0) {
    const proteinRatio = totals.protein_g / targets.protein_g;
    if (proteinRatio >= 0.9) {
      tips.push({ text: "Excellent protein intake today—keep including protein in each meal to support satiety and muscle maintenance.", type: "positive" });
    } else if (proteinRatio >= 0.6) {
      tips.push({ text: "You could add a small protein source (yogurt, eggs, lentils, nuts) to one of your meals for better balance.", type: "improvement" });
    } else {
      tips.push({ text: "Try anchoring each meal with a clear protein source (beans, tofu, fish, eggs, yogurt) for better satiety.", type: "improvement" });
    }
  }

  // Calorie tips
  if (targets.calories_kcal > 0 && totals.calories_kcal > 0) {
    const calRatio = totals.calories_kcal / targets.calories_kcal;
    if (calRatio > 1.15) {
      tips.push({ text: "On higher-calorie days, balance things out with a lighter meal or extra movement tomorrow.", type: "improvement" });
    } else if (calRatio < 0.7) {
      tips.push({ text: "If you often eat below target, consider adding a balanced snack so energy stays steady throughout the day.", type: "improvement" });
    }
  }

  // Fiber tips
  if (fiber >= 20) {
    tips.push({ text: "Nice fiber intake today—keep including fruits, veggies, and whole grains for gut and heart health.", type: "positive" });
  } else if (fiber > 0 && fiber < 15 && totals.calories_kcal > 0) {
    tips.push({ text: "Fiber was a bit low—more vegetables, fruits, beans, or whole grains would help gut and heart health.", type: "improvement" });
  }

  // Sodium tips
  if (sodium > 2300) {
    tips.push({ text: "Sodium leaned high today; using fewer packaged foods and more home-cooked meals can bring this down.", type: "improvement" });
  }

  // Omega-3 tips
  if (omega3Mg > 0) {
    tips.push({ text: "Good job adding some omega-3–rich foods or supplements today; they support heart and brain health.", type: "positive" });
  }

  // Goal-specific tips
  const goal = userProfile.goal ?? "";
  if ((goal.includes("cholesterol") || goal.includes("heart")) && totals.fat_g > 0) {
    if (totals.fat_g > (targets.fat_g ?? 0) * 1.2) {
      tips.push({ text: "For heart and cholesterol health, keep favoring unsaturated fats (nuts, seeds, fish, olive oil) over deep-fried or very creamy foods.", type: "improvement" });
    } else {
      tips.push({ text: "Your fat choices today look good for heart health—keep leaning on unsaturated fat sources.", type: "positive" });
    }
  }

  // Meal timing tips
  if (mealsLogged.length === 1) {
    tips.push({ text: "Spreading intake across breakfast, lunch, and dinner can help keep energy and hunger more stable.", type: "improvement" });
  }
  if (!mealsLogged.some((m) => /breakfast/i.test(m))) {
    tips.push({ text: "If mornings allow, a simple breakfast (fruit + yogurt, oats, eggs) can support focus and appetite control.", type: "improvement" });
  }

  // De-duplicate by text and limit
  const seen = new Set<string>();
  const uniqueTips = tips.filter((t) => {
    if (seen.has(t.text)) return false;
    seen.add(t.text);
    return true;
  }).slice(0, 6);

  return { summary, tips: uniqueTips };
}

type BestInsight = {
  affirmation: string;
  category: string;
  value: string;
  message: string;
} | null;

function getBestInsightFromYesterday(
  yesterdayData: DayData,
  userProfile: UserProfile
): BestInsight {
  const { meals, mealItems } = yesterdayData;
  const totals = meals.reduce((acc, m) => sumTotals(acc, m.nutrients), emptyTotals());
  const microTotals = getMicroTotalsFromItems(mealItems);
  const targets = getMacroTargets(userProfile);
  
  // Check if there are any meals logged
  const mealsLogged: string[] = [];
  for (const meal of meals) {
    const items = mealItems[meal.id] ?? [];
    if (items.length > 0 || meal.nutrients.calories_kcal > 0) {
      mealsLogged.push(meal.label);
    }
  }
  
  if (mealsLogged.length === 0) {
    return null; // No meals logged yesterday
  }

  // Priority: Protein > Calories on target > Fiber > Meal consistency
  const insights: BestInsight[] = [];

  // 1. Protein achievement (highest priority)
  if (targets.protein_g > 0 && totals.protein_g > 0) {
    const proteinRatio = totals.protein_g / targets.protein_g;
    if (proteinRatio >= 0.9) {
      insights.push({
        affirmation: "Well done!",
        category: "PROTEIN",
        value: `${Math.round(totals.protein_g)}g`,
        message: "EXCELLENT PROTEIN INTAKE! Keep including protein in each meal to support satiety and muscle maintenance."
      });
    } else if (proteinRatio >= 0.7) {
      insights.push({
        affirmation: "Making progress!",
        category: "PROTEIN",
        value: `${Math.round(totals.protein_g)}g`,
        message: "Good protein intake yesterday. Adding a bit more protein to your meals can help with satiety and energy."
      });
    }
  }

  // 2. Calories on target
  if (targets.calories_kcal > 0 && totals.calories_kcal > 0) {
    const calRatio = totals.calories_kcal / targets.calories_kcal;
    if (calRatio >= 0.85 && calRatio <= 1.15) {
      insights.push({
        affirmation: "Great balance!",
        category: "CALORIES",
        value: `${Math.round(totals.calories_kcal)}`,
        message: "Your calories were right on target yesterday—this kind of consistency supports your goals."
      });
    }
  }

  // 3. Fiber achievement
  const fiber = microTotals.fiber_g ?? 0;
  if (fiber >= 20) {
    insights.push({
      affirmation: "Nice work!",
      category: "FIBER",
      value: `${Math.round(fiber)}g`,
      message: "Excellent fiber intake yesterday! Keep including fruits, veggies, and whole grains for gut and heart health."
    });
  }

  // 4. Meal consistency
  if (mealsLogged.length >= 3) {
    insights.push({
      affirmation: "Consistency wins!",
      category: "MEALS",
      value: `${mealsLogged.length}`,
      message: `You logged ${mealsLogged.length} meals yesterday—this kind of consistency really helps long-term progress.`
    });
  }

  // Return the first (highest priority) insight, or a general encouraging one
  if (insights.length > 0) {
    return insights[0];
  }

  // Fallback: general encouragement
  return {
    affirmation: "Keep going!",
    category: "TRACKING",
    value: `${mealsLogged.length}`,
    message: `You logged ${mealsLogged.length} meal${mealsLogged.length !== 1 ? "s" : ""} yesterday. Every day of tracking brings you closer to your goals.`
  };
}

function aggregateWeekData(
  dataByDate: Record<string, DayData>,
  todayKey: string
): { totals: NutrientTotals; microTotals: Record<MicroKey, number>; foods: string[]; mealsLogged: Set<string>; daysWithMeals: number } {
  let totals = emptyTotals();
  const microTotals = {} as Record<MicroKey, number>;
  for (const k of MICRO_KEYS) microTotals[k] = 0;
  const foods: string[] = [];
  const mealsLogged = new Set<string>();
  let daysWithMeals = 0;
  for (let i = 1; i <= 7; i++) {
    const dk = addDays(todayKey, -i);
    const day = dataByDate[dk];
    if (!day || !dayHasMeals(day)) continue;
    daysWithMeals += 1;
    const dayTotals = day.meals.reduce((acc, m) => sumTotals(acc, m.nutrients), emptyTotals());
    totals = sumTotals(totals, dayTotals);
    const mt = getMicroTotalsFromItems(day.mealItems);
    for (const k of MICRO_KEYS) microTotals[k] += mt[k] ?? 0;
    for (const meal of day.meals) {
      const items = day.mealItems[meal.id] ?? [];
      if (items.length > 0 || meal.nutrients.calories_kcal > 0) {
        mealsLogged.add(meal.label);
        for (const it of items) {
          const n = capitalizeFirst(stripParenthetical(it.name));
          if (n && !foods.includes(n)) foods.push(n);
        }
      }
    }
  }
  return { totals, microTotals, foods, mealsLogged, daysWithMeals };
}

function getWeekInsights(
  dataByDate: Record<string, DayData>,
  todayKey: string,
  userProfile: UserProfile
): InsightResult {
  const { totals, microTotals, foods, mealsLogged, daysWithMeals } = aggregateWeekData(dataByDate, todayKey);
  const targets = getMacroTargets(userProfile);
  const avgCal = daysWithMeals > 0 ? Math.round(totals.calories_kcal / daysWithMeals) : 0;
  const calPct = targets.calories_kcal > 0 && daysWithMeals > 0
    ? Math.round((totals.calories_kcal / (targets.calories_kcal * daysWithMeals)) * 100)
    : 0;
  const proteinPct = targets.protein_g > 0 && daysWithMeals > 0
    ? Math.round((totals.protein_g / (targets.protein_g * daysWithMeals)) * 100)
    : 0;
  const fiber = microTotals.fiber_g ?? 0;
  const sodium = microTotals.sodium_mg ?? 0;
  const omega3Mg = (microTotals.omega_3_g ?? 0) * 1000;

  // Build concise, pattern-focused summary (no detailed numbers)
  let summary = "";
  if (daysWithMeals > 0) {
    summary = `Over the past 7 days you logged meals on ${daysWithMeals} day${daysWithMeals !== 1 ? "s" : ""}, which is a solid foundation.`;
    if (mealsLogged.size > 0) {
      summary += ` You covered meal types like ${Array.from(mealsLogged).join(", ")}.`;
    }
  } else {
    summary = "Once you've logged for a few days in a row, this section will show patterns across your week.";
  }

  // Add qualitative weekly assessment
  if (daysWithMeals > 0 && targets.calories_kcal > 0) {
    const calPct = targets.calories_kcal > 0 && daysWithMeals > 0
      ? Math.round((totals.calories_kcal / (targets.calories_kcal * daysWithMeals)) * 100)
      : 0;
    if (calPct >= 90 && calPct <= 110) {
      summary += " Average daily calories were close to your weekly target—nice consistency.";
    } else if (calPct > 110) {
      summary += " Average calories were a bit above target; a couple of lighter days could balance things out.";
    } else {
      summary += " Average calories were somewhat below target; make sure energy and recovery still feel good.";
    }
  }

  if (daysWithMeals > 0 && targets.protein_g > 0) {
    const proteinPct = targets.protein_g > 0 && daysWithMeals > 0
      ? Math.round((totals.protein_g / (targets.protein_g * daysWithMeals)) * 100)
      : 0;
    if (proteinPct >= 90) {
      summary += " Weekly protein intake has been strong overall—great for satiety and muscle maintenance.";
    } else if (proteinPct >= 70) {
      summary += " Protein has been okay across the week, but there's room to add a bit more on some days.";
    }
  }

  // Tips with positive reinforcement (green) and constructive suggestions (orange)
  const tips: InsightTip[] = [];

  // Always start with positive reinforcement
  tips.push({ text: "You're building a useful record of your eating patterns—keep going, even on less-perfect days.", type: "positive" });

  // Consistency tips
  if (daysWithMeals >= 5) {
    tips.push({ text: "Excellent consistency logging this week—tracking regularly helps you spot patterns and make informed choices.", type: "positive" });
  } else if (daysWithMeals >= 3) {
    tips.push({ text: "Good start logging this week—try to log at least 4–5 days next week to spot clearer trends.", type: "improvement" });
  } else if (daysWithMeals > 0) {
    tips.push({ text: "Try logging at least 3–4 days this coming week to spot clearer trends and opportunities.", type: "improvement" });
  }

  // Calorie tips
  if (daysWithMeals >= 5 && targets.calories_kcal > 0) {
    const calPct = Math.round((totals.calories_kcal / (targets.calories_kcal * daysWithMeals)) * 100);
    if (calPct > 110) {
      tips.push({ text: "Since weekly calories trended high, you might balance heavier meals with lighter, veggie-rich ones.", type: "improvement" });
    } else if (calPct < 85) {
      tips.push({ text: "If energy ever feels low, experiment with slightly larger portions or an extra nutritious snack.", type: "improvement" });
    }
  }

  // Protein tips
  if (daysWithMeals > 0 && targets.protein_g > 0) {
    const proteinPct = Math.round((totals.protein_g / (targets.protein_g * daysWithMeals)) * 100);
    if (proteinPct >= 90) {
      tips.push({ text: "Your weekly protein intake has been excellent—this supports satiety, muscle maintenance, and overall health.", type: "positive" });
    } else if (proteinPct >= 70) {
      tips.push({ text: "Protein intake has been decent—adding a protein source to one extra meal each day would boost it nicely.", type: "improvement" });
    }
  }

  // Sodium tips
  const avgSodium = daysWithMeals > 0 ? sodium / daysWithMeals : 0;
  if (avgSodium > 2300) {
    tips.push({ text: "Across the week, sodium was on the higher side—cooking more at home and tasting before salting can help.", type: "improvement" });
  }

  // Fiber tips
  const avgFiber = daysWithMeals > 0 ? fiber / daysWithMeals : 0;
  if (avgFiber >= 20) {
    tips.push({ text: "Great fiber intake across the week—keep prioritizing fruits, vegetables, and whole grains.", type: "positive" });
  } else if (avgFiber < 20 && daysWithMeals > 0) {
    tips.push({ text: "Most days could use a bit more fiber—aim to add a fruit or veggie to one extra meal each day.", type: "improvement" });
  }

  // Omega-3 tips
  if (omega3Mg > 0 && daysWithMeals > 0) {
    tips.push({ text: "Nice job including omega-3 sources this week—they support heart and brain health.", type: "positive" });
  }

  // Goal-specific tips
  const goal = userProfile.goal ?? "";
  if ((goal.includes("cholesterol") || goal.includes("heart")) && daysWithMeals > 0) {
    const avgFat = totals.fat_g / Math.max(1, daysWithMeals);
    if (avgFat > (targets.fat_g ?? 0) * 1.15) {
      tips.push({ text: "For your heart and cholesterol goals, emphasizing fish, nuts, seeds, and olive oil over deep-fried foods will pay off.", type: "improvement" });
    } else {
      tips.push({ text: "Your weekly fat intake looks reasonable for heart health—keep leaning on unsaturated fat sources.", type: "positive" });
    }
  }

  // De-duplicate by text and limit
  const seen = new Set<string>();
  const uniqueTips = tips.filter((t) => {
    if (seen.has(t.text)) return false;
    seen.add(t.text);
    return true;
  }).slice(0, 6);

  return { summary, tips: uniqueTips };
}

function getContributors(
  sel: SelectedNutrient,
  items: Record<string, MealItem[]>,
  _totals: NutrientTotals
): { name: string; amount: number }[] {
  const key =
    sel.type === "macro"
      ? sel.key
      : sel.type === "micro" && sel.key
        ? sel.key
        : null;
  if (!key) return [];
  const out: { name: string; amount: number }[] = [];
  for (const mealId of Object.keys(items)) {
    const list = items[mealId] ?? [];
    for (const item of list) {
      const amt = (item.nutrients as Record<string, number>)[key] ?? 0;
      if (amt > 0)
        out.push({
          name: capitalizeFirst(stripParenthetical(item.name)),
          amount: amt
        });
    }
  }
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

function AppContent() {
  const { isPro, isLoading: subscriptionLoading, presentPaywall, presentCustomerCenter, resetSubscriptionForTesting } = useSubscription();
  const [view, setView] = useState<"home" | "add" | "meal" | "export" | "personal" | "savedFoods">("home");
  const [activeTab, setActiveTab] = useState<TabId>("meals");
  const [selectedNutrient, setSelectedNutrient] = useState<SelectedNutrient | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [selectedFoodItem, setSelectedFoodItem] = useState<MealItem | null>(null);
  const [editableFoodNutrients, setEditableFoodNutrients] = useState<NutrientTotals | null>(null);
  const [originalFoodNutrients, setOriginalFoodNutrients] = useState<NutrientTotals | null>(null);
  const [foodSaveMessage, setFoodSaveMessage] = useState<string | null>(null);
  const [foodSaving, setFoodSaving] = useState(false);
  const [knownFoods, setKnownFoods] = useState<string[]>([]);
  const [foodNutrients, setFoodNutrients] = useState<Record<string, NutrientTotals>>({});
  const [foodOverrides, setFoodOverrides] = useState<Record<string, NutrientTotals>>({});
  const [foodServingGrams, setFoodServingGrams] = useState<Record<string, number>>({});
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [foodInsights, setFoodInsights] = useState<{
    insights: string;
    tips: string[];
    healthQuotient: number;
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [entryText, setEntryText] = useState("");
  const [dataByDate, setDataByDate] = useState<Record<string, DayData>>({});
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [insightsSubTab, setInsightsSubTab] = useState<"day" | "week">("day");
  const [exportRange, setExportRange] = useState<"7" | "30" | "custom">("7");
  const [exportStartDate, setExportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateKey(d);
  });
  const [exportEndDate, setExportEndDate] = useState<string>(() => toDateKey(new Date()));
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">("cm");
  const [heightValue, setHeightValue] = useState<string>("");
  const [weightValue, setWeightValue] = useState<string>("");
  const [dobValue, setDobValue] = useState<string>("");
  const [dobDay, setDobDay] = useState<string>("14");
  const [dobMonth, setDobMonth] = useState<string>("Jul");
  const [dobYear, setDobYear] = useState<string>("1981");
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showHeightUnitDropdown, setShowHeightUnitDropdown] = useState(false);
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [yesterdayInsightDismissed, setYesterdayInsightDismissed] = useState<string>("");
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [editingSavedFoodName, setEditingSavedFoodName] = useState<string | null>(null);
  const [savedFoodEditName, setSavedFoodEditName] = useState("");
  const [savedFoodEditCalories, setSavedFoodEditCalories] = useState("");
  const [savedFoodEditServingGrams, setSavedFoodEditServingGrams] = useState("");
  const [savedFoodDeleteConfirm, setSavedFoodDeleteConfirm] = useState<string | null>(null);
  const [savedFoodsSearchQuery, setSavedFoodsSearchQuery] = useState("");

  const addScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (view !== "add") return;
    const sub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(() => {
          addScrollRef.current?.scrollTo({ y: 0, animated: true });
        }, 50);
      }
    );
    return () => sub.remove();
  }, [view]);

  const todayKey = toDateKey(new Date());
  const yesterdayKey = addDays(todayKey, -1);

  const getDayData = useCallback(
    (dateKey: string): DayData => {
      const stored = dataByDate[dateKey];
      if (stored) return stored;
      return getDefaultDayData();
    },
    [dataByDate]
  );

  const persistData = useCallback(async (next: Record<string, DayData>) => {
    try {
      // Only persist last 90 days to reduce storage size, but be more lenient
      const today = toDateKey(new Date());
      const toPersist: Record<string, DayData> = {};
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      for (const [date, data] of Object.entries(next)) {
        // Parse date string (format: YYYY-MM-DD)
        const dateParts = date.split("-");
        if (dateParts.length === 3) {
          try {
            const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
            dateObj.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((dateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
            // Keep data from last 90 days and future dates (up to 7 days ahead)
            // Also keep today's data even if calculation is off
            if (daysDiff >= -90 && daysDiff <= 7) {
              toPersist[date] = data;
            } else if (date === today) {
              // Always keep today's data
              toPersist[date] = data;
            }
          } catch (e) {
            // If date parsing fails, keep the data to prevent loss
            console.warn(`Failed to parse date ${date}, keeping data anyway`);
            toPersist[date] = data;
          }
        } else {
          // If date format is invalid, keep the data anyway to prevent loss
          console.warn(`Invalid date format: ${date}, keeping data anyway`);
          toPersist[date] = data;
        }
      }
      
      const persistedCount = Object.keys(toPersist).length;
      const totalCount = Object.keys(next).length;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
      if (persistedCount < totalCount) {
        console.log(`Persisted ${persistedCount} of ${totalCount} days (filtered ${totalCount - persistedCount} days older than 90 days)`);
      } else {
        console.log(`Persisted ${persistedCount} days of data`);
      }
    } catch (err) {
      console.error("Error persisting data:", err);
      // Try to save at least today's data as fallback
      try {
        const today = toDateKey(new Date());
        const todayData = next[today];
        if (todayData) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ [today]: todayData }));
          console.log("Saved at least today's data as fallback");
        }
      } catch (fallbackErr) {
        console.error("Failed to save fallback data:", fallbackErr);
      }
    }
  }, []);

  const persistProfile = useCallback(async (profile: UserProfile) => {
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (_) {}
  }, []);

  const persistKnownFoods = useCallback(
    async (foods: string[]) => {
      try {
        await AsyncStorage.setItem(FOOD_SUGGESTIONS_KEY, JSON.stringify(foods));
      } catch (_) {}
    },
    []
  );

  const persistFoodNutrients = useCallback(
    async (nutrients: Record<string, NutrientTotals>) => {
      try {
        await AsyncStorage.setItem(FOOD_NUTRIENTS_KEY, JSON.stringify(nutrients));
      } catch (_) {}
    },
    []
  );

  const persistFoodOverrides = useCallback(
    async (overrides: Record<string, NutrientTotals>) => {
      try {
        await AsyncStorage.setItem(FOOD_OVERRIDES_KEY, JSON.stringify(overrides));
      } catch (_) {}
    },
    []
  );

  const persistFoodServingGrams = useCallback(
    async (servingGrams: Record<string, number>) => {
      try {
        await AsyncStorage.setItem(FOOD_SERVING_GRAMS_KEY, JSON.stringify(servingGrams));
      } catch (_) {}
    },
    []
  );

  const persistMealTemplates = useCallback(
    async (templates: MealTemplate[]) => {
      try {
        await AsyncStorage.setItem(MEAL_TEMPLATES_KEY, JSON.stringify(templates));
      } catch (_) {}
    },
    []
  );

  const buildKnownFoodsFromData = useCallback(
    async (allData: Record<string, DayData>) => {
      try {
        // If we've already built/saved suggestions before, don't overwrite them
        const existing = await AsyncStorage.getItem(FOOD_SUGGESTIONS_KEY);
        if (existing) return;

        // Use Map with normalized key -> canonical name for case-insensitive deduplication
        const nameMap = new Map<string, string>();
        for (const day of Object.values(allData)) {
          if (!day || !day.mealItems) continue;
          for (const items of Object.values(day.mealItems)) {
            (items || []).forEach((item) => {
              if (item && item.name) {
                const normalizedKey = normalizeFoodNameForDedup(item.name);
                const canonical = getCanonicalFoodName(item.name);
                if (normalizedKey && canonical) {
                  // Keep the first occurrence's capitalization, or prefer shorter canonical name
                  const existing = nameMap.get(normalizedKey);
                  if (!existing || canonical.length < existing.length) {
                    nameMap.set(normalizedKey, canonical);
                  }
                }
              }
            });
          }
        }

        const list = Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b));
        setKnownFoods(list);
        if (list.length) {
          await persistKnownFoods(list);
        }
      } catch (err) {
        console.warn("Failed to build known foods from existing data:", err);
      }
    },
    []
  );

  // Loading screen image is loaded via require() - no need for async loading

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();
    const MIN_LOADING_TIME = 1500; // Minimum 1.5 seconds to show loading screen
    
    (async () => {
      try {
        // First, check all keys to see what's available
        const allKeys = await AsyncStorage.getAllKeys();
        console.log("All AsyncStorage keys:", allKeys);
        
        // Try to find data with various possible keys (in case key changed)
        const possibleKeys = [
          STORAGE_KEY,
          "@mealtracking_dataByDate",
          "mealtracking_dataByDate",
          "dataByDate",
          "@meal_tracking_data",
          "meal_tracking_data"
        ];
        
        let foundData = null;
        let foundKey = null;
        
        for (const key of possibleKeys) {
          try {
            const raw = await AsyncStorage.getItem(key);
            if (raw && raw.length > 10) { // Minimum data check
              console.log(`Found data in key: ${key} (${raw.length} characters)`);
              try {
                const parsed = JSON.parse(raw);
                if (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length > 0) {
                  foundData = parsed;
                  foundKey = key;
                  console.log(`Recovered ${Object.keys(parsed).length} days from key: ${key}`);
                  break;
                }
              } catch (parseErr) {
                console.warn(`Failed to parse data from ${key}:`, parseErr);
              }
            }
          } catch (keyErr) {
            // Continue checking other keys
          }
        }
        
        if (cancelled) return;
        
        if (foundData) {
          console.log(`Successfully recovered data from key: ${foundKey}`);
          const migrated = migrateDataForVitamins(foundData);
          const dayCount = Object.keys(migrated).length;
          console.log(`Loaded ${dayCount} days of meal data`);
          
          // Save to the current key if it was found in a different key
          if (foundKey !== STORAGE_KEY) {
            console.log(`Migrating data from ${foundKey} to ${STORAGE_KEY}`);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          } else if (migrated !== foundData) {
            // Save migrated data back
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
          
          if (!cancelled) {
            setDataByDate(migrated);
            await buildKnownFoodsFromData(migrated);
          }
        } else {
          // Try the primary key as fallback
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (cancelled) return;
          if (raw) {
            console.log(`Loaded data from storage: ${raw.length} characters`);
            const parsed = JSON.parse(raw);
            if (typeof parsed === "object" && parsed !== null) {
              const migrated = migrateDataForVitamins(parsed);
              const dayCount = Object.keys(migrated).length;
              console.log(`Loaded ${dayCount} days of meal data`);
              if (migrated !== parsed) {
                // Save migrated data back
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
              }
              if (!cancelled) {
                setDataByDate(migrated);
                await buildKnownFoodsFromData(migrated);
              }
            } else {
              console.warn("Parsed data is not an object:", typeof parsed);
            }
          } else {
            console.log("No data found in storage - checking for backups...");
            
            // Try to find any JSON data that might be meal data
            for (const key of allKeys) {
              if (key.includes("meal") || key.includes("data") || key.includes("tracking")) {
                try {
                  const value = await AsyncStorage.getItem(key);
                  if (value && value.length > 50) {
                    try {
                      const testParsed = JSON.parse(value);
                      if (typeof testParsed === "object" && testParsed !== null) {
                        // Check if it looks like meal data (has date keys or meal structure)
                        const keys = Object.keys(testParsed);
                        if (keys.length > 0 && (keys[0].match(/^\d{4}-\d{2}-\d{2}$/) || testParsed.meals || testParsed.mealItems)) {
                          console.log(`Found potential meal data in key: ${key}`);
                          console.log(`Attempting recovery from: ${key}`);
                          const migrated = migrateDataForVitamins(testParsed);
                          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                          if (!cancelled) {
                            setDataByDate(migrated);
                            await buildKnownFoodsFromData(migrated);
                          }
                          console.log(`Recovered ${Object.keys(migrated).length} days of data!`);
                          break;
                        }
                      }
                    } catch (e) {
                      // Not JSON or not meal data
                    }
                  }
                } catch (e) {
                  // Continue checking
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      }
      
      // Load user profile
      try {
        const profileRaw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (!cancelled) {
          if (profileRaw) {
            const profileParsed = JSON.parse(profileRaw);
            setUserProfile(profileParsed);
            if (profileParsed.dateOfBirth) {
              const dateParts = profileParsed.dateOfBirth.split("-");
              if (dateParts.length === 3) {
                const [y, m, d] = dateParts;
                const day = parseInt(d, 10) || 1;
                const month = parseInt(m, 10) || 1;
                const year = y || "";
                const monthMap: Record<string, string> = {
                  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
                  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
                };
                setDobValue(`${day}/${month}/${year}`);
                setDobYear(year);
                setDobMonth(monthMap[m] || "Jan");
                setDobDay(String(day));
              }
            }
            if (profileParsed.heightCm) {
              const heightVal = profileParsed.heightUnit === "in" 
                ? Math.round(profileParsed.heightCm / 2.54).toString()
                : Math.round(profileParsed.heightCm).toString();
              const clampedVal = profileParsed.heightUnit === "in"
                ? Math.max(36, Math.min(85, parseInt(heightVal) || 68)).toString()
                : Math.max(100, Math.min(220, parseInt(heightVal) || 173)).toString();
              setHeightValue(clampedVal);
              setHeightUnit(profileParsed.heightUnit);
            }
            if (profileParsed.weightKg) {
              setWeightValue(Math.round(profileParsed.weightKg).toString());
            }
          } else {
            // First‑time user: no profile saved yet — open Personal Details screen
            console.log("No existing user profile found; opening personal details on first launch");
            setView("personal");
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      }

      // Load known foods for autocomplete
      try {
        const foodsRaw = await AsyncStorage.getItem(FOOD_SUGGESTIONS_KEY);
        if (!cancelled && foodsRaw) {
          const parsed = JSON.parse(foodsRaw);
          if (Array.isArray(parsed)) {
            const validFoods = parsed.filter((f) => typeof f === "string");
            // Deduplicate when loading (case-insensitive)
            const nameMap = new Map<string, string>();
            validFoods.forEach((name: string) => {
              const normalizedKey = normalizeFoodNameForDedup(name);
              const canonical = getCanonicalFoodName(name);
              if (normalizedKey && canonical) {
                // Keep first occurrence or prefer shorter name
                const existing = nameMap.get(normalizedKey);
                if (!existing || canonical.length < existing.length) {
                  nameMap.set(normalizedKey, canonical);
                }
              }
            });
            const deduplicated = Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b));
            setKnownFoods(deduplicated);
            // Persist deduplicated version back if it changed
            if (deduplicated.length !== validFoods.length) {
              await persistKnownFoods(deduplicated);
            }
          }
        }
      } catch (err) {
        console.warn("Error loading known foods:", err);
      }

      // Load yesterday insight dismissed state
      try {
        const dismissedRaw = await AsyncStorage.getItem(YESTERDAY_INSIGHT_DISMISSED_KEY);
        if (!cancelled && dismissedRaw) {
          setYesterdayInsightDismissed(dismissedRaw);
        }
      } catch (err) {
        console.warn("Error loading yesterday insight dismissed state:", err);
      }

      // Load per‑food nutrient overrides
      try {
        const overridesRaw = await AsyncStorage.getItem(FOOD_OVERRIDES_KEY);
        if (!cancelled && overridesRaw) {
          const parsed = JSON.parse(overridesRaw);
          if (parsed && typeof parsed === "object") {
            setFoodOverrides(parsed as Record<string, NutrientTotals>);
          }
        }
      } catch (err) {
        console.warn("Error loading food overrides:", err);
      }

      // Load per-food serving size (grams) for saved foods display
      try {
        const servingRaw = await AsyncStorage.getItem(FOOD_SERVING_GRAMS_KEY);
        if (!cancelled && servingRaw) {
          const parsed = JSON.parse(servingRaw);
          if (parsed && typeof parsed === "object") {
            const out: Record<string, number> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "number" && v > 0) out[k] = v;
            }
            setFoodServingGrams(out);
          }
        }
      } catch (err) {
        console.warn("Error loading food serving grams:", err);
      }

      // Load cached food nutrients (for known-foods reuse)
      try {
        const nutrientsRaw = await AsyncStorage.getItem(FOOD_NUTRIENTS_KEY);
        let nutrients: Record<string, NutrientTotals> = {};
        if (nutrientsRaw) {
          const parsed = JSON.parse(nutrientsRaw);
          if (parsed && typeof parsed === "object") {
            nutrients = parsed as Record<string, NutrientTotals>;
          }
        }
        const initialCount = Object.keys(nutrients).length;
        const dataRaw = await AsyncStorage.getItem(STORAGE_KEY);
        if (dataRaw && !cancelled) {
          try {
            const data = JSON.parse(dataRaw) as Record<string, DayData>;
            if (data && typeof data === "object") {
              for (const day of Object.values(data)) {
                if (!day?.mealItems) continue;
                for (const items of Object.values(day.mealItems)) {
                  for (const item of items || []) {
                    if (item?.name && item.grams > 0 && item.nutrients) {
                      const key = normalizeFoodNameForDedup(item.name);
                      if (key && !nutrients[key]) {
                        nutrients[key] = scaleTotals(item.nutrients, 100 / item.grams);
                      }
                    }
                  }
                }
              }
              if (Object.keys(nutrients).length > initialCount) {
                await AsyncStorage.setItem(FOOD_NUTRIENTS_KEY, JSON.stringify(nutrients));
              }
            }
          } catch (_) {}
        }
        if (!cancelled) {
          setFoodNutrients(nutrients);
        }
      } catch (err) {
        console.warn("Error loading food nutrients cache:", err);
      }

      // Load meal templates
      try {
        const templatesRaw = await AsyncStorage.getItem(MEAL_TEMPLATES_KEY);
        if (!cancelled && templatesRaw) {
          const parsed = JSON.parse(templatesRaw);
          if (Array.isArray(parsed)) {
            setMealTemplates(parsed.filter((t) => t && t.id && t.name && Array.isArray(t.items)));
          }
        }
      } catch (err) {
        console.warn("Error loading meal templates:", err);
      }
      
      // Ensure loading screen shows for at least MIN_LOADING_TIME
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      
      if (!cancelled) {
        setTimeout(() => {
          if (!cancelled) setHydrated(true);
        }, remaining);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Migrate: add inferred serving sizes for existing known foods that don't have one
  useEffect(() => {
    if (!hydrated || knownFoods.length === 0) return;
    let needsUpdate = false;
    const next = { ...foodServingGrams };
    for (const name of knownFoods) {
      const key = normalizeFoodNameForKey(name);
      if (key && !(key in next)) {
        next[key] = inferDefaultServingGrams(name);
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      setFoodServingGrams(next);
      persistFoodServingGrams(next);
    }
  }, [hydrated, knownFoods]);

  // Debug: Log view changes
  useEffect(() => {
    console.log("View changed to:", view);
  }, [view]);

  const dayData = getDayData(selectedDate);
  const meals = dayData.meals;
  const mealItems = dayData.mealItems;
  const totals = meals.reduce((acc, meal) => sumTotals(acc, meal.nutrients), emptyTotals());
  const microTotals = getMicroTotalsFromItems(mealItems);

  // Yesterday's insight card logic
  const yesterdayData = getDayData(yesterdayKey);
  const bestInsight = useMemo(() => getBestInsightFromYesterday(yesterdayData, userProfile), [yesterdayData, userProfile]);
  const isMorning = new Date().getHours() < 12; // Before noon
  const shouldShowInsight = useMemo(() => {
    if (!bestInsight) return false;
    if (!isMorning) return false;
    if (selectedDate !== todayKey) return false; // Only show when viewing today
    if (yesterdayInsightDismissed === todayKey) return false; // Already dismissed today
    return true;
  }, [bestInsight, isMorning, selectedDate, todayKey, yesterdayInsightDismissed]);

  const handleDismissInsight = useCallback(async () => {
    setYesterdayInsightDismissed(todayKey);
    try {
      await AsyncStorage.setItem(YESTERDAY_INSIGHT_DISMISSED_KEY, todayKey);
    } catch (err) {
      console.warn("Error saving dismissed insight:", err);
    }
  }, [todayKey]);

  // Analysis tab uses the same date as MEALS page
  const analysisDayData = getDayData(selectedDate);
  const analysisMeals = analysisDayData?.meals ?? [];
  const analysisMealItems = analysisDayData?.mealItems ?? {};
  const analysisTotals = analysisMeals.reduce((acc, meal) => sumTotals(acc, meal?.nutrients ?? emptyTotals()), emptyTotals());
  const analysisMicroTotals = getMicroTotalsFromItems(analysisMealItems);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;
  const SIDEBAR_WIDTH = Math.min(280, screenWidth * 0.78);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => {
    if (menuVisible) {
      sidebarAnim.setValue(-SIDEBAR_WIDTH);
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, [menuVisible, sidebarAnim, SIDEBAR_WIDTH]);

  const closeSidebar = useCallback(() => {
    Animated.timing(sidebarAnim, {
      toValue: -SIDEBAR_WIDTH,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => setMenuVisible(false));
  }, [sidebarAnim, SIDEBAR_WIDTH]);

  // Reset animation when date changes
  useEffect(() => {
    slideAnim.setValue(0);
  }, [selectedDate, slideAnim]);

  const goToPrevDay = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start(() => {
      setSelectedDate((prev) => addDays(prev, -1));
    });
  }, [slideAnim, screenWidth]);

  const goToNextDay = useCallback(() => {
    const next = addDays(selectedDate, 1);
    if (next <= todayKey) {
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start(() => {
        setSelectedDate(next);
      });
    }
  }, [selectedDate, todayKey, slideAnim, screenWidth]);

  const canGoNext = addDays(selectedDate, 1) <= todayKey;

  const SWIPE_THRESHOLD = 50;
  const mealsSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const { dx, dy } = g;
          return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5;
        },
        onPanResponderGrant: () => {
          slideAnim.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const { dx } = g;
          // Use a smoother, more responsive tracking with damping
          const dampingFactor = 0.8;
          const clampedDx = Math.max(-screenWidth * 0.4, Math.min(screenWidth * 0.4, dx * dampingFactor));
          slideAnim.setValue(clampedDx);
        },
        onPanResponderRelease: (_, g) => {
          const { dx, vx } = g;
          const velocity = vx || 0;
          const hasVelocity = Math.abs(velocity) > 0.3;
          const hasDistance = Math.abs(dx) > SWIPE_THRESHOLD;
          
          if ((hasDistance && dx > 0) || (hasVelocity && velocity > 0.5)) {
            goToPrevDay();
          } else if ((hasDistance && dx < 0 && canGoNext) || (hasVelocity && velocity < -0.5 && canGoNext)) {
            goToNextDay();
          } else {
            // Snap back smoothly if swipe wasn't strong enough
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
              velocity: velocity,
            }).start();
          }
        },
      }),
    [goToPrevDay, goToNextDay, canGoNext, slideAnim, screenWidth]
  );

  const fetchFoodInsights = useCallback(async (item: MealItem, mealId?: string | null) => {
    try {
      setLoadingInsights(true);
      
      // Get current day's data for context
      const currentDayData = getDayData(selectedDate);
      const currentMeals = currentDayData.meals;
      const currentMealItems = currentDayData.mealItems;
      
      // Get meal type from mealId
      const meal = currentMeals.find((m) => m.id === mealId);
      const mealType = meal?.label?.toLowerCase().replace(/\s+/g, "-") || undefined;
      
      // Helper to clean food names for matching
      const cleanFoodName = (name: string) => name.replace(/\s*\([^)]*\)\s*/g, " ").trim().toLowerCase();
      
      // Get all other foods logged today (excluding current item)
      // Include foods from the same meal AND other meals to check for pairings
      const allFoodsToday: Array<{ name: string; mealType?: string }> = [];
      for (const [mid, items] of Object.entries(currentMealItems)) {
        const mealLabel = currentMeals.find((m) => m.id === mid)?.label?.toLowerCase().replace(/\s+/g, "-");
        for (const foodItem of items) {
          if (foodItem.id !== item.id) {
            // Clean the food name (remove parenthetical info) for better matching
            const cleanName = cleanFoodName(foodItem.name);
            allFoodsToday.push({
              name: cleanName,
              mealType: mealLabel
            });
          }
        }
      }
      
      // Also get foods from the same meal specifically for pairing suggestions
      const sameMealFoods = mealId && currentMealItems[mealId]
        ? currentMealItems[mealId]
            .filter(f => f.id !== item.id)
            .map(f => cleanFoodName(f.name))
        : [];

      // Build userContext from profile (goal, age, weight, height, gender, activity, BMI)
      const age = userProfile.dateOfBirth ? getAgeFromDOB(userProfile.dateOfBirth) : null;
      const weightKg = userProfile.weightKg ?? null;
      const heightCm = userProfile.heightCm ?? null;
      const bmi = weightKg != null && heightCm != null && heightCm > 0
        ? weightKg / Math.pow(heightCm / 100, 2)
        : null;
      const userContext = {
        goal: userProfile.goal ?? undefined,
        age: age ?? undefined,
        weightKg: weightKg ?? undefined,
        heightCm: heightCm ?? undefined,
        genderAtBirth: userProfile.genderAtBirth ?? undefined,
        activityLevel: userProfile.activityLevel ?? undefined,
        bmi: bmi ?? undefined
      };
      
      const url = `${API_BASE_URL}/meals/food-insights`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: item.name,
          nutrients: item.nutrients,
          quantity: item.quantity,
          unit: item.unit,
          grams: item.grams,
          mealType: mealType,
          userContext,
          otherFoodsToday: allFoodsToday,
          sameMealFoods: sameMealFoods
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch insights`);
      }
      const data = await res.json();
      setFoodInsights({
        insights: data.insights || "",
        tips: data.tips || [],
        healthQuotient: data.healthQuotient || 70
      });
    } catch (error) {
      console.error("Failed to fetch food insights:", error);
      // Set default insights if API fails
      setFoodInsights({
        insights: `${capitalizeFirst(stripParenthetical(item.name))} provides essential nutrients for your health.`,
        tips: [],
        healthQuotient: 70
      });
    } finally {
      setLoadingInsights(false);
    }
  }, [selectedDate, getDayData, userProfile]);

  // Note: fetchFoodInsights is now called directly when item is tapped
  // This useEffect is kept for cleanup
  useEffect(() => {
    if (!selectedFoodItem) {
      setFoodInsights(null);
    }
  }, [selectedFoodItem]);

  const openAdd = (mealId: string) => {
    setSelectedMealId(mealId);
    setError(null);
    setIsTemplateMode(false);
    setEditingTemplateId(null);
    setView("add");
  };

  const handleAdd = async () => {
    if (isTemplateMode) return; // Don't add meals when editing template mode
    if (!selectedMealId || !entryText.trim()) return;
    try {
      Keyboard.dismiss();
      setLoading(true);
      setError(null);
      let resolvedItems: MealItem[];
      const cached = resolveFromKnownFoods(entryText, knownFoods, foodNutrients);
      if (cached && cached.length > 0) {
        resolvedItems = cached;
      } else {
        try {
          const res = await fetch(`${API_BASE_URL}/meals/nl-log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: entryText,
              startedAt: `${selectedDate}T12:00:00.000Z`,
              tzOffsetMinutes: new Date().getTimezoneOffset()
            })
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload?.error || "Failed to log meal.");
          }
          const data = (await res.json()) as MealResponse & { items?: MealItem[] };
          const apiItems = data.items || [];
          if (apiItems.length > 0) {
            resolvedItems = apiItems;
            const nextNutrients = { ...foodNutrients };
            for (const item of apiItems) {
              if (item && item.name && item.grams > 0 && item.nutrients) {
                const key = normalizeFoodNameForDedup(item.name);
                if (key) {
                  const nutrientsPer100g = scaleTotals(item.nutrients, 100 / item.grams);
                  nextNutrients[key] = nutrientsPer100g;
                }
              }
            }
            setFoodNutrients(nextNutrients);
            await persistFoodNutrients(nextNutrients);
          } else {
            resolvedItems = parseFoodTextLocally(entryText);
            if (resolvedItems.length === 0) {
              throw new Error("Could not parse any foods. Try formats like \"100g chicken\" or \"2 eggs\".");
            }
          }
        } catch (apiErr) {
          const localItems = parseFoodTextLocally(entryText);
          if (localItems.length > 0) {
            resolvedItems = localItems;
          } else {
            throw apiErr;
          }
        }
      }

      // Apply any saved per‑food overrides to incoming items
      const finalItems: MealItem[] = resolvedItems.map((item) => {
        const key = normalizeFoodNameForKey(item.name);
        const override = foodOverrides[key];
        return override ? { ...item, nutrients: override } : item;
      });

      // Recompute total nutrients from (possibly overridden) items
      const resolvedTotals = finalItems.reduce(
        (acc, item) => sumTotals(acc, item.nutrients),
        emptyTotals()
      );

      const day = getDayData(selectedDate);
      const nextMeals = day.meals.map((meal) =>
        meal.id === selectedMealId
          ? { ...meal, nutrients: sumTotals(meal.nutrients, resolvedTotals) }
          : meal
      );
      const nextItems = {
        ...day.mealItems,
        [selectedMealId]: [...(day.mealItems[selectedMealId] || []), ...finalItems]
      };
      const next = { ...dataByDate, [selectedDate]: { meals: nextMeals, mealItems: nextItems } };
      setDataByDate(next);

      // Update known foods from new items (with case-insensitive deduplication)
      if (finalItems.length > 0) {
        const nameMap = new Map<string, string>();
        knownFoods.forEach((name) => {
          const key = normalizeFoodNameForDedup(name);
          if (key) nameMap.set(key, name);
        });
        finalItems.forEach((item) => {
          if (item && item.name) {
            const normalizedKey = normalizeFoodNameForDedup(item.name);
            const canonical = getCanonicalFoodName(item.name);
            if (normalizedKey && canonical) {
              if (!nameMap.has(normalizedKey)) {
                nameMap.set(normalizedKey, canonical);
              } else {
                const existing = nameMap.get(normalizedKey);
                if (existing && canonical.length < existing.length) {
                  nameMap.set(normalizedKey, canonical);
                }
              }
            }
          }
        });
        const mergedList = Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b));
        setKnownFoods(mergedList);
        await persistKnownFoods(mergedList);

        const nextServing = { ...foodServingGrams };
        finalItems.forEach((item) => {
          if (item && item.name) {
            const canonical = getCanonicalFoodName(item.name);
            const key = normalizeFoodNameForKey(canonical);
            if (key && !(key in nextServing)) {
              nextServing[key] = inferDefaultServingGrams(canonical);
            }
          }
        });
        if (Object.keys(nextServing).length !== Object.keys(foodServingGrams).length) {
          setFoodServingGrams(nextServing);
          await persistFoodServingGrams(nextServing);
        }
      }

      await persistData(next);
      setEntryText("");
      setView("home");
    } catch (err) {
      let message = "Unknown error";
      if (err instanceof Error) {
        if (err.message.includes("Network request failed")) {
          message =
            "Could not reach the server. Your meal text is still here; please tap Add again when you’re back in the app.";
        } else {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !entryText.trim()) {
      setError("Template name and items are required");
      return;
    }

    const items = entryText.split("\n").filter(Boolean);
    if (items.length === 0) {
      setError("At least one food item is required");
      return;
    }

    if (editingTemplateId) {
      // Update existing template
      const updated = mealTemplates.map((t) =>
        t.id === editingTemplateId
          ? { ...t, name: templateName.trim(), items }
          : t
      );
      setMealTemplates(updated);
      persistMealTemplates(updated);
    } else {
      // Create new template
      const newTemplate: MealTemplate = {
        id: Date.now().toString(),
        name: templateName.trim(),
        items
      };
      const updated = [...mealTemplates, newTemplate];
      setMealTemplates(updated);
      persistMealTemplates(updated);
    }

    // Reset and go back
    setEditingTemplateId(null);
    setIsTemplateMode(false);
    setTemplateName("");
    setEntryText("");
    setView("home");
    setError(null);
  };

  const handleDeleteItem = (mealId: string, itemId: string) => {
    const day = getDayData(selectedDate);
    const items = day.mealItems[mealId] || [];
    const itemToRemove = items.find((item) => item.id === itemId);
    if (!itemToRemove) return;
    const updatedItems = items.filter((item) => item.id !== itemId);
    const nextMeals = day.meals.map((meal) =>
      meal.id === mealId
        ? { ...meal, nutrients: subtractTotals(meal.nutrients, itemToRemove.nutrients) }
        : meal
    );
    const nextItems = { ...day.mealItems, [mealId]: updatedItems };
    const next = { ...dataByDate, [selectedDate]: { meals: nextMeals, mealItems: nextItems } };
    setDataByDate(next);
    persistData(next);
  };

  const selectedMealLabel =
    meals.find((meal) => meal.id === selectedMealId)?.label || "";
  const selectedItems =
    (selectedMealId && mealItems[selectedMealId]) || [];

  const attemptDataRecovery = useCallback(async () => {
    try {
      console.log("=== Starting data recovery ===");
      const allKeys = await AsyncStorage.getAllKeys();
      console.log("All AsyncStorage keys:", allKeys);
      
      const possibleKeys = [
        STORAGE_KEY,
        "@mealtracking_dataByDate",
        "mealtracking_dataByDate",
        "dataByDate",
        "@meal_tracking_data",
        "meal_tracking_data",
        ...allKeys.filter(k => k.includes("meal") || k.includes("data") || k.includes("tracking"))
      ];
      
      let recoveredData = null;
      let recoveredKey = null;
      
      for (const key of possibleKeys) {
        try {
          const raw = await AsyncStorage.getItem(key);
          if (raw && raw.length > 10) {
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed === "object" && parsed !== null) {
                // Check if it looks like meal data
                const keys = Object.keys(parsed);
                const hasDateKeys = keys.some(k => k.match(/^\d{4}-\d{2}-\d{2}$/));
                const hasMealStructure = keys.some(k => {
                  const val = parsed[k];
                  return val && (val.meals || val.mealItems);
                });
                
                if (hasDateKeys || hasMealStructure) {
                  console.log(`Found meal data in key: ${key} (${keys.length} entries)`);
                  recoveredData = parsed;
                  recoveredKey = key;
                  break;
                }
              }
            } catch (e) {
              // Not valid JSON
            }
          }
        } catch (e) {
          // Continue
        }
      }
      
      if (recoveredData) {
        const migrated = migrateDataForVitamins(recoveredData);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        setDataByDate(migrated);
        console.log(`=== Recovery successful! Restored ${Object.keys(migrated).length} days ===`);
        return true;
      } else {
        console.log("=== No recoverable data found ===");
        return false;
      }
    } catch (err) {
      console.error("Recovery error:", err);
      return false;
    }
  }, []);

  const handleSaveProfile = async () => {
    const heightNum = heightValue ? parseFloat(heightValue) : null;
    const heightInCm = heightNum 
      ? (heightUnit === "in" ? heightNum * 2.54 : heightNum)
      : null;
    
    const weightNum = weightValue ? parseFloat(weightValue) : null;
    const weightInKg = weightNum
      ? (weightUnit === "lbs" ? weightNum / 2.20462 : weightNum)
      : null;
    
    // Parse DOB from dd/mm/yyyy to ISO yyyy-mm-dd
    let formattedDate: string | null = null;
    if (dobValue) {
      const match = dobValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) {
        const [, d, m, y] = match;
        const day = parseInt(d, 10);
        const month = parseInt(m, 10);
        const year = parseInt(y, 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
    
    const updatedProfile: UserProfile = {
      dateOfBirth: formattedDate,
      genderAtBirth: userProfile.genderAtBirth,
      heightCm: heightInCm,
      heightUnit: heightUnit,
      weightKg: weightInKg,
      goal: userProfile.goal,
      activityLevel: userProfile.activityLevel
    };
    
    setUserProfile(updatedProfile);
    await persistProfile(updatedProfile);
    setView("home");
  };

  // Show personal details screen - CHECK THIS FIRST BEFORE ANY OTHER VIEWS
  if (view === "personal") {
    console.log("Rendering personal details screen");
    const goals = [
      { id: "weight_loss", label: "Weight Loss" },
      { id: "weight_gain", label: "Weight Gain" },
      { id: "maintain_weight", label: "Maintain Weight" },
      { id: "reduce_cholesterol", label: "Reduce Cholesterol" },
      { id: "reduce_cholesterol_maintain_weight", label: "Reduce Cholesterol & Maintain Weight" },
      { id: "muscle_gain", label: "Muscle Gain" },
      { id: "heart_health", label: "Heart Health" },
      { id: "diabetes_management", label: "Diabetes Management" }
    ];

    const activityLevels = [
      { 
        id: "low", 
        label: "Low", 
        description: "Little to no exercise, desk job" 
      },
      { 
        id: "medium", 
        label: "Medium", 
        description: "Light exercise 1-3 days/week" 
      },
      { 
        id: "high", 
        label: "High", 
        description: "Moderate to intense exercise 4+ days/week" 
      }
    ];

    // Generate date picker items
    const days = Array.from({ length: 31 }, (_, i) => ({
      label: String(i + 1),
      value: String(i + 1)
    }));
    const months = [
      { label: "Jan", value: "Jan" },
      { label: "Feb", value: "Feb" },
      { label: "Mar", value: "Mar" },
      { label: "Apr", value: "Apr" },
      { label: "May", value: "May" },
      { label: "Jun", value: "Jun" },
      { label: "Jul", value: "Jul" },
      { label: "Aug", value: "Aug" },
      { label: "Sep", value: "Sep" },
      { label: "Oct", value: "Oct" },
      { label: "Nov", value: "Nov" },
      { label: "Dec", value: "Dec" }
    ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => ({
      label: String(currentYear - i),
      value: String(currentYear - i)
    }));

    // Generate height values
    const heightValuesCm = Array.from({ length: 100 }, (_, i) => ({
      label: `${i + 100} cm`,
      value: String(i + 100)
    }));
    const heightValuesIn = Array.from({ length: 50 }, (_, i) => ({
      label: `${i + 36} in`,
      value: String(i + 36)
    }));

    // Generate weight values
    const weightValues = Array.from({ length: 150 }, (_, i) => ({
      label: `${i + 30} kg`,
      value: String(i + 30)
    }));

    const genderOptions = [
      { label: "Male", value: "male" },
      { label: "Female", value: "female" }
    ];

    const goalOptions = goals.map((g) => ({ label: g.label, value: g.id }));
    const activityOptions = activityLevels.map((a) => ({ label: a.label, value: a.id }));

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.personalHeader}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setView("home")}>
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            Personal Details
          </Text>
          <TouchableOpacity style={styles.personalSaveButton} onPress={handleSaveProfile}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.personalDetailsContent}
          scrollEnabled={true}
        >
          {/* SUBSCRIPTION */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>SUBSCRIPTION</Text>
            <TouchableOpacity
              style={styles.fieldValue}
              onPress={() => presentCustomerCenter()}
            >
              <Text style={styles.fieldValueText}>
                {subscriptionLoading ? "Loading..." : isPro ? "Pro" : "Free"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.manageSubscriptionButton}
            onPress={() => presentCustomerCenter()}
          >
            <Text style={styles.manageSubscriptionButtonText}>Manage Subscription</Text>
          </TouchableOpacity>

          {/* DATE OF BIRTH */}
          {(() => {
            let isValidDob = true;
            if (dobValue) {
              const match = dobValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (!match) {
                isValidDob = false;
              } else {
                const [, d, m, y] = match;
                const day = parseInt(d, 10);
                const month = parseInt(m, 10);
                const year = parseInt(y, 10);
                if (
                  isNaN(day) ||
                  isNaN(month) ||
                  isNaN(year) ||
                  day < 1 ||
                  day > 31 ||
                  month < 1 ||
                  month > 12
                ) {
                  isValidDob = false;
                }
              }
            }

            const renderAge = () => {
              if (!dobValue || !isValidDob) return null;
              const [d, m, y] = dobValue.split("/");
              const day = parseInt(d, 10);
              const month = parseInt(m, 10);
              const year = parseInt(y, 10);
              if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
              const iso = `${year}-${String(month).padStart(2, "0")}-${String(
                day
              ).padStart(2, "0")}`;
              const age = getAgeFromDOB(iso);
              return age ? <Text style={styles.helperText}>Age: {age} years</Text> : null;
            };

            return (
              <>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
                  <TextInput
                    style={[
                      styles.fieldValue,
                      styles.fieldValueInput,
                      !isValidDob && styles.fieldValueError
                    ]}
                    value={dobValue}
                    onChangeText={setDobValue}
                    placeholder="dd/mm/yyyy"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                {renderAge()}
              </>
            );
          })()}

          {/* GENDER */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>GENDER AT BIRTH</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
            >
              <Text style={styles.fieldValueText}>
                {userProfile.genderAtBirth
                  ? userProfile.genderAtBirth === "male"
                    ? "Male"
                    : "Female"
                  : "Select gender"}
              </Text>
            </TouchableOpacity>
          </View>
          {showGenderDropdown && (
            <Modal visible={showGenderDropdown} transparent animationType="fade">
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowGenderDropdown(false)}
              >
                <View style={styles.dropdownContent}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setUserProfile({ ...userProfile, genderAtBirth: option.value as "male" | "female" });
                        setShowGenderDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* HEIGHT */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>HEIGHT</Text>
            <View style={styles.heightInputRow}>
              <TextInput
                style={styles.heightInput}
                value={heightValue}
                onChangeText={setHeightValue}
                placeholder="Enter height"
                keyboardType="decimal-pad"
              />
              <TouchableOpacity 
                style={styles.unitDropdown}
                onPress={() => setShowHeightUnitDropdown(!showHeightUnitDropdown)}
              >
                <Text style={styles.fieldValueText}>{heightUnit}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showHeightUnitDropdown && (
            <Modal visible={showHeightUnitDropdown} transparent animationType="fade">
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowHeightUnitDropdown(false)}
              >
                <View style={styles.dropdownContent}>
                  {["cm", "in"].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={styles.dropdownItem}
                      onPress={() => {
                        if (heightValue) {
                          const num = parseFloat(heightValue);
                          if (heightUnit === "cm" && unit === "in") {
                            setHeightValue((num / 2.54).toFixed(1));
                          } else if (heightUnit === "in" && unit === "cm") {
                            setHeightValue((num * 2.54).toFixed(1));
                          }
                        }
                        setHeightUnit(unit as "cm" | "in");
                        setShowHeightUnitDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{unit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* WEIGHT */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>WEIGHT</Text>
            <View style={styles.heightInputRow}>
              <TextInput
                style={styles.heightInput}
                value={weightValue}
                onChangeText={setWeightValue}
                placeholder="Enter weight"
                keyboardType="decimal-pad"
              />
              <TouchableOpacity 
                style={styles.unitDropdown}
                onPress={() => setShowWeightUnitDropdown(!showWeightUnitDropdown)}
              >
                <Text style={styles.fieldValueText}>{weightUnit}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showWeightUnitDropdown && (
            <Modal visible={showWeightUnitDropdown} transparent animationType="fade">
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowWeightUnitDropdown(false)}
              >
                <View style={styles.dropdownContent}>
                  {["kg", "lbs"].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={styles.dropdownItem}
                      onPress={() => {
                        if (weightValue) {
                          const num = parseFloat(weightValue);
                          if (weightUnit === "kg" && unit === "lbs") {
                            setWeightValue((num * 2.20462).toFixed(1));
                          } else if (weightUnit === "lbs" && unit === "kg") {
                            setWeightValue((num / 2.20462).toFixed(1));
                          }
                        }
                        setWeightUnit(unit as "kg" | "lbs");
                        setShowWeightUnitDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{unit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* GOAL */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>GOAL</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => setShowGoalDropdown(!showGoalDropdown)}
            >
              <Text style={styles.fieldValueText}>
                {goalOptions.find(g => g.value === userProfile.goal)?.label || "Select goal"}
              </Text>
            </TouchableOpacity>
          </View>
          {showGoalDropdown && (
            <Modal visible={showGoalDropdown} transparent animationType="fade">
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowGoalDropdown(false)}
              >
                <View style={styles.dropdownContent}>
                  {goalOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setUserProfile({ ...userProfile, goal: option.value });
                        setShowGoalDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* ACTIVITY LEVEL */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>ACTIVITY LEVEL</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => setShowActivityDropdown(!showActivityDropdown)}
            >
              <Text style={styles.fieldValueText}>
                {activityOptions.find(a => a.value === userProfile.activityLevel)?.label || "Select activity level"}
              </Text>
            </TouchableOpacity>
          </View>
          {showActivityDropdown && (
            <Modal visible={showActivityDropdown} transparent animationType="fade">
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowActivityDropdown(false)}
              >
                <View style={styles.dropdownContent}>
                  {activityOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setUserProfile({ ...userProfile, activityLevel: option.value });
                        setShowActivityDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (view === "savedFoods") {
    const getCaloriesPer100gForSavedFood = (name: string): number | null => {
      const key = normalizeFoodNameForKey(name);
      const nutrients = foodOverrides[key] ?? foodNutrients[key] ?? foodNutrients[name];
      if (nutrients && typeof nutrients.calories_kcal === "number") return nutrients.calories_kcal;
      return null;
    };

    const getServingGramsForSavedFood = (name: string): number => {
      const key = normalizeFoodNameForKey(name);
      const g = foodServingGrams[key];
      if (typeof g === "number" && g > 0) return g;
      return inferDefaultServingGrams(name);
    };

    const handleSaveSavedFoodEdit = async () => {
      if (!editingSavedFoodName) return;
      const newName = savedFoodEditName.trim();
      const caloriesPerServing = parseFloat(savedFoodEditCalories);
      const servingGrams = (() => {
        const n = parseFloat(savedFoodEditServingGrams);
        return Number.isFinite(n) && n > 0 ? n : 100;
      })();
      if (!newName) {
        setEditingSavedFoodName(null);
        return;
      }
      const keyOld = normalizeFoodNameForKey(editingSavedFoodName);
      const keyNew = normalizeFoodNameForKey(newName);
      const existingNutrients = foodOverrides[keyOld] ?? foodNutrients[keyOld] ?? foodNutrients[editingSavedFoodName] ?? emptyTotals();
      const caloriesPer100g = Number.isFinite(caloriesPerServing) && servingGrams > 0
        ? (caloriesPerServing * 100) / servingGrams
        : existingNutrients.calories_kcal;
      const newNutrients: NutrientTotals = { ...existingNutrients, calories_kcal: caloriesPer100g };

      if (keyOld !== keyNew || editingSavedFoodName !== newName) {
        const nextKnown = knownFoods.filter((n) => normalizeFoodNameForKey(n) !== keyOld);
        if (!nextKnown.includes(newName)) nextKnown.push(newName);
        nextKnown.sort((a, b) => a.localeCompare(b));
        setKnownFoods(nextKnown);
        await persistKnownFoods(nextKnown);

        const nextOverrides = { ...foodOverrides };
        delete nextOverrides[keyOld];
        nextOverrides[keyNew] = newNutrients;
        setFoodOverrides(nextOverrides);
        await persistFoodOverrides(nextOverrides);

        const nextServing = { ...foodServingGrams };
        delete nextServing[keyOld];
        nextServing[keyNew] = servingGrams;
        setFoodServingGrams(nextServing);
        await persistFoodServingGrams(nextServing);
      } else {
        const nextOverrides = { ...foodOverrides, [keyOld]: newNutrients };
        setFoodOverrides(nextOverrides);
        await persistFoodOverrides(nextOverrides);

        const nextServing = { ...foodServingGrams, [keyOld]: servingGrams };
        setFoodServingGrams(nextServing);
        await persistFoodServingGrams(nextServing);
      }
      setEditingSavedFoodName(null);
    };

    const handleDeleteSavedFood = async (name: string) => {
      const key = normalizeFoodNameForKey(name);
      const nextKnown = knownFoods.filter((n) => normalizeFoodNameForKey(n) !== key);
      setKnownFoods(nextKnown);
      await persistKnownFoods(nextKnown);
      const nextOverrides = { ...foodOverrides };
      delete nextOverrides[key];
      setFoodOverrides(nextOverrides);
      await persistFoodOverrides(nextOverrides);
      const nextServing = { ...foodServingGrams };
      delete nextServing[key];
      setFoodServingGrams(nextServing);
      await persistFoodServingGrams(nextServing);
      setSavedFoodDeleteConfirm(null);
    };

    return (
      <SafeAreaView style={[styles.container, { paddingTop: 8 }]}>
        <View style={styles.fixedHeader}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setView("home")}
          >
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Saved foods</Text>
          </View>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.savedFoodsSearchWrap}>
          <TextInput
            style={styles.savedFoodsSearchInput}
            value={savedFoodsSearchQuery}
            onChangeText={setSavedFoodsSearchQuery}
            placeholder="Search saved foods..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.savedFoodsListContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {(() => {
            const q = savedFoodsSearchQuery.trim().toLowerCase();
            const filtered = q
              ? knownFoods.filter((name) => name.toLowerCase().includes(q))
              : knownFoods;
            if (knownFoods.length === 0) {
              return <Text style={styles.savedFoodsEmpty}>No saved foods yet. Add meals and they’ll appear here.</Text>;
            }
            if (filtered.length === 0) {
              return <Text style={styles.savedFoodsEmpty}>No results for "{savedFoodsSearchQuery.trim()}"</Text>;
            }
            return filtered.map((name) => {
              const caloriesPer100g = getCaloriesPer100gForSavedFood(name);
              const servingGrams = getServingGramsForSavedFood(name);
              const caloriesForServing =
                caloriesPer100g !== null
                  ? Math.round((caloriesPer100g * servingGrams) / 100)
                  : null;
              const isDeleting = savedFoodDeleteConfirm === name;
              return (
                <View key={name} style={styles.savedFoodsRow}>
                  <View style={styles.savedFoodsRowTop}>
                    <View style={styles.savedFoodsRowLeft}>
                      <Text style={styles.savedFoodsRowName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.savedFoodsRowCalories}>
                        {caloriesForServing !== null
                          ? `${servingGrams}g, ${caloriesForServing} calories`
                          : `${servingGrams}g, —`}
                      </Text>
                    </View>
                    <View style={styles.savedFoodsRowActions}>
                    <TouchableOpacity
                      style={styles.savedFoodsActionButton}
                      onPress={() => {
                        setEditingSavedFoodName(name);
                        setSavedFoodEditName(name);
                        const per100 = getCaloriesPer100gForSavedFood(name);
                        const serv = getServingGramsForSavedFood(name);
                        setSavedFoodEditCalories(
                          per100 !== null ? String(Math.round((per100 * serv) / 100)) : ""
                        );
                        setSavedFoodEditServingGrams(String(serv));
                      }}
                    >
                      <Image
                        source={require("./assets/Edit_duotone_line.png")}
                        style={styles.savedFoodsActionIconImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.savedFoodsActionButton}
                      onPress={() => setSavedFoodDeleteConfirm(isDeleting ? null : name)}
                    >
                      <Image
                        source={require("./assets/Trash_light.png")}
                        style={styles.savedFoodsActionIconImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                  </View>
                  {isDeleting && (
                    <View style={styles.savedFoodsDeleteConfirm}>
                      <Text style={styles.savedFoodsDeleteConfirmText}>Delete "{name}"?</Text>
                      <View style={styles.savedFoodsDeleteConfirmActions}>
                        <TouchableOpacity
                          style={styles.savedFoodsDeleteConfirmCancel}
                          onPress={() => setSavedFoodDeleteConfirm(null)}
                        >
                          <Text style={styles.savedFoodsDeleteConfirmCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.savedFoodsDeleteConfirmOk}
                          onPress={() => handleDeleteSavedFood(name)}
                        >
                          <Text style={styles.savedFoodsDeleteConfirmOkText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            });
          })()}
        </ScrollView>

        <Modal
          visible={editingSavedFoodName !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingSavedFoodName(null)}
        >
          <View style={styles.savedFoodsEditModalOverlay}>
            <View style={styles.savedFoodsEditModal}>
              <Text style={styles.savedFoodsEditModalTitle}>Edit food</Text>
              <Text style={styles.savedFoodsEditModalLabel}>Name</Text>
              <TextInput
                style={styles.savedFoodsEditModalInput}
                value={savedFoodEditName}
                onChangeText={setSavedFoodEditName}
                placeholder="Food name"
                autoCapitalize="words"
              />
              <Text style={styles.savedFoodsEditModalLabel}>Serving size (g)</Text>
              <TextInput
                style={styles.savedFoodsEditModalInput}
                value={savedFoodEditServingGrams}
                onChangeText={setSavedFoodEditServingGrams}
                placeholder="e.g. 100, 20, 1"
                keyboardType="numeric"
              />
              <Text style={styles.savedFoodsEditModalLabel}>Calories (per serving)</Text>
              <TextInput
                style={styles.savedFoodsEditModalInput}
                value={savedFoodEditCalories}
                onChangeText={setSavedFoodEditCalories}
                placeholder="e.g. 150"
                keyboardType="numeric"
              />
              <View style={styles.savedFoodsEditModalActions}>
                <TouchableOpacity
                  style={styles.savedFoodsEditModalCancel}
                  onPress={() => setEditingSavedFoodName(null)}
                >
                  <Text style={styles.savedFoodsEditModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.savedFoodsEditModalSave}
                  onPress={handleSaveSavedFoodEdit}
                >
                  <Text style={styles.savedFoodsEditModalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (view === "add") {
    // Parse current line to extract prefix (quantity/unit) and food name part
    const lines = entryText.split("\n");
    const currentLine = lines[lines.length - 1] || "";
    
    // Try to extract prefix: matches patterns like "1 ", "10g ", "2 cups ", etc.
    // Pattern: number (optional decimal) + optional unit + space(s)
    const prefixMatch = currentLine.match(/^(\d+(?:\.\d+)?(?:\s*(?:g|kg|mg|ml|l|cups?|tbsp|tsp|oz|lb|pieces?|slices?|servings?))?\s+)/i);
    const prefix = prefixMatch ? prefixMatch[0] : "";
    const foodNamePart = currentLine.slice(prefix.length).trim().toLowerCase();
    
    const suggestions =
      foodNamePart.length === 0
        ? []
        : knownFoods
            .filter((name) => name.toLowerCase().startsWith(foodNamePart))
            .slice(0, 5);

    return (
      <SafeAreaView style={[styles.container, { paddingTop: 8 }]}>
        <KeyboardAvoidingView
          style={styles.addScreen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.addHeader}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setView("home");
                setEditingTemplateId(null);
                setTemplateName("");
                setEntryText("");
              }}
            >
              <Text style={styles.iconText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isTemplateMode ? (editingTemplateId ? "Edit Template" : "New Template") : "Add item(s)"}
            </Text>
            {isTemplateMode ? (
              <View style={styles.templateHeaderButtons}>
                {editingTemplateId && (
                  <TouchableOpacity
                    style={styles.templateDeleteButton}
                    onPress={() => {
                      if (editingTemplateId) {
                        const updated = mealTemplates.filter((t) => t.id !== editingTemplateId);
                        setMealTemplates(updated);
                        persistMealTemplates(updated);
                        setEditingTemplateId(null);
                        setTemplateName("");
                        setEntryText("");
                        setIsTemplateMode(false);
                        setView("home");
                      }
                    }}
                  >
                    <Text style={styles.templateDeleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.addHeaderButton}
                  onPress={handleSaveTemplate}
                >
                  <Text style={styles.addHeaderButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addHeaderButton, loading && styles.addSubmitDisabled]}
                onPress={handleAdd}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.addHeaderButtonText,
                    loading && styles.addSubmitTextDisabled
                  ]}
                >
                  {loading ? "Adding..." : "Add"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            ref={addScrollRef}
            style={styles.addScroll}
            contentContainerStyle={styles.addScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
          >
            {isTemplateMode && (
              <View style={styles.templateNameContainer}>
                <Text style={styles.templateNameLabel}>Template name</Text>
                <TextInput
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="Template name"
                  style={styles.templateNameInputCompact}
                  autoFocus={false}
                />
              </View>
            )}
            <View style={styles.addCard}>
              <Text style={styles.addHint}>
                {isTemplateMode ? "Food items (one per line)" : "Describe the food items and we will do the rest"}
              </Text>
              <TextInput
                value={entryText}
                onChangeText={setEntryText}
                placeholder=""
                style={styles.addInput}
                multiline
                textAlignVertical="top"
                editable
                autoFocus={!isTemplateMode}
                scrollEnabled={false}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((name) => {
                    const lines = entryText.split("\n");
                    const currentLine = lines[lines.length - 1] || "";
                    const prefixMatch = currentLine.match(/^(\d+(?:\.\d+)?(?:\s*(?:g|kg|mg|ml|l|cups?|tbsp|tsp|oz|lb|pieces?|slices?|servings?))?\s+)/i);
                    const prefix = prefixMatch ? prefixMatch[0] : "";
                    return (
                      <TouchableOpacity
                        key={name}
                        style={styles.suggestionChip}
                        onPress={() => {
                          const text = entryText;
                          const textLines = text.split("\n");
                          const lastIdx = textLines.length - 1;
                          const currLine = textLines[lastIdx] ?? "";
                          const prefixMatch2 = currLine.match(/^(\d+(?:\.\d+)?(?:\s*(?:g|kg|mg|ml|l|cups?|tbsp|tsp|oz|lb|pieces?|slices?|servings?))?\s+)/i);
                          const prefix2 = prefixMatch2 ? prefixMatch2[0] : "";
                          const replacedLine = prefix2 + name;
                          const replacedLines = [
                            ...textLines.slice(0, lastIdx),
                            replacedLine
                          ];
                          const nextText = replacedLines.join("\n");
                          setEntryText(nextText);
                        }}
                      >
                        <Text style={styles.suggestionText}>{prefix ? prefix + name : name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {mealTemplates.length > 0 && (
              <View style={styles.templatesSection}>
                <Text style={styles.templatesSectionTitle}>Saved Meal Templates</Text>
                <View style={styles.templatesContainer}>
                  {mealTemplates.map((template) => (
                    <View key={template.id} style={styles.templateChipWrapper}>
                      <TouchableOpacity
                        style={styles.templateChip}
                        onPress={() => {
                          setEntryText(template.items.join("\n"));
                        }}
                      >
                        <Text style={styles.templateChipText}>{template.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.templateEditButton}
                        onPress={() => {
                          setEditingTemplateId(template.id);
                          setIsTemplateMode(true);
                          setTemplateName(template.name);
                          setEntryText(template.items.join("\n"));
                          setView("add");
                        }}
                      >
                        <Text style={styles.templateEditButtonText}>✎</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {error ? <Text style={styles.addError}>{error}</Text> : null}
            {selectedMealLabel && !isTemplateMode ? (
              <Text style={styles.addFooter}>Adding to {selectedMealLabel}</Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show food detail screen if a food item is selected
  if (selectedFoodItem !== null && editableFoodNutrients !== null && originalFoodNutrients !== null) {
    const isFoodDirty =
      Math.round(editableFoodNutrients.calories_kcal) !== Math.round(originalFoodNutrients.calories_kcal) ||
      Math.round(editableFoodNutrients.protein_g) !== Math.round(originalFoodNutrients.protein_g) ||
      Math.round(editableFoodNutrients.carbs_g) !== Math.round(originalFoodNutrients.carbs_g) ||
      Math.round(editableFoodNutrients.fat_g) !== Math.round(originalFoodNutrients.fat_g);
    const handleUpdateFoodNutrients = async () => {
      const day = getDayData(selectedDate);
      if (!selectedMealId) return;
      const items = day.mealItems[selectedMealId] || [];
      const idx = items.findIndex((i) => i.id === selectedFoodItem.id);
      if (idx === -1) return;

      const oldItem = items[idx];
      const oldNutrients = oldItem.nutrients;
      const newNutrients: NutrientTotals = {
        ...oldNutrients,
        ...editableFoodNutrients
      };

      const updatedItem: MealItem = {
        ...oldItem,
        nutrients: newNutrients
      };

      const updatedItems = [...items];
      updatedItems[idx] = updatedItem;

      const nextMeals = day.meals.map((meal) =>
        meal.id === selectedMealId
          ? {
              ...meal,
              nutrients: sumTotals(
                subtractTotals(meal.nutrients, oldNutrients),
                newNutrients
              )
            }
          : meal
      );

      const next = {
        ...dataByDate,
        [selectedDate]: { meals: nextMeals, mealItems: { ...day.mealItems, [selectedMealId]: updatedItems } }
      };

      try {
        setFoodSaving(true);
        setDataByDate(next);
        await persistData(next);
        setSelectedFoodItem(updatedItem);
        setOriginalFoodNutrients(newNutrients);

        // Remember per‑food override for future uses
        const overrideKey = normalizeFoodNameForKey(updatedItem.name);
        const nextOverrides = { ...foodOverrides, [overrideKey]: newNutrients };
        setFoodOverrides(nextOverrides);
        await persistFoodOverrides(nextOverrides);

        // Also add to known foods with deduplication
        const normalizedKey = normalizeFoodNameForDedup(updatedItem.name);
        const canonical = getCanonicalFoodName(updatedItem.name);
        if (normalizedKey && canonical) {
          const nameMap = new Map<string, string>();
          knownFoods.forEach((name) => {
            const key = normalizeFoodNameForDedup(name);
            if (key) nameMap.set(key, name);
          });
          if (!nameMap.has(normalizedKey)) {
            nameMap.set(normalizedKey, canonical);
            const updatedKnownFoods = Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b));
            setKnownFoods(updatedKnownFoods);
            await persistKnownFoods(updatedKnownFoods);
          }
        }

        if (!(overrideKey in foodServingGrams)) {
          const nextServing = { ...foodServingGrams, [overrideKey]: inferDefaultServingGrams(updatedItem.name) };
          setFoodServingGrams(nextServing);
          await persistFoodServingGrams(nextServing);
        }

        setFoodSaveMessage("Changes saved");
      } finally {
        setFoodSaving(false);
      }
    };

    return (
      <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
        <SafeAreaView style={{ backgroundColor: "#F5F5F7" }}>
          <View style={styles.fixedHeader}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setSelectedFoodItem(null)}
            >
              <Text style={styles.iconText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {capitalizeFirst(stripParenthetical(selectedFoodItem.name)).toUpperCase()}
              </Text>
            </View>
            <View style={styles.iconButton} />
          </View>
        </SafeAreaView>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.foodDetailContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.foodDetailSection}>
            <Text style={styles.foodDetailSectionTitle}>Nutrition Facts</Text>
            <View style={styles.foodDetailMacros}>
              <View style={styles.foodDetailMacroCard}>
                <Text style={styles.foodDetailMacroLabel}>Calories</Text>
                <TextInput
                  style={styles.foodDetailMacroInput}
                  keyboardType="numeric"
                  value={String(Math.round(editableFoodNutrients.calories_kcal))}
                  onChangeText={(text) => {
                    setFoodSaveMessage(null);
                    setEditableFoodNutrients({
                      ...editableFoodNutrients,
                      calories_kcal: Number(text) || 0
                    });
                  }}
                />
              </View>
              <View style={styles.foodDetailMacroCard}>
                <Text style={styles.foodDetailMacroLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.foodDetailMacroInput}
                  keyboardType="numeric"
                  value={String(Math.round(editableFoodNutrients.protein_g))}
                  onChangeText={(text) => {
                    setFoodSaveMessage(null);
                    setEditableFoodNutrients({
                      ...editableFoodNutrients,
                      protein_g: Number(text) || 0
                    });
                  }}
                />
              </View>
              <View style={styles.foodDetailMacroCard}>
                <Text style={styles.foodDetailMacroLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.foodDetailMacroInput}
                  keyboardType="numeric"
                  value={String(Math.round(editableFoodNutrients.carbs_g))}
                  onChangeText={(text) => {
                    setFoodSaveMessage(null);
                    setEditableFoodNutrients({
                      ...editableFoodNutrients,
                      carbs_g: Number(text) || 0
                    });
                  }}
                />
              </View>
              <View style={styles.foodDetailMacroCard}>
                <Text style={styles.foodDetailMacroLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.foodDetailMacroInput}
                  keyboardType="numeric"
                  value={String(Math.round(editableFoodNutrients.fat_g))}
                  onChangeText={(text) => {
                    setFoodSaveMessage(null);
                    setEditableFoodNutrients({
                      ...editableFoodNutrients,
                      fat_g: Number(text) || 0
                    });
                  }}
                />
              </View>
            </View>

            <View style={styles.foodDetailSection}>
              <TouchableOpacity
                style={[
                  styles.foodDetailSaveButton,
                  (!isFoodDirty || foodSaving) && styles.foodDetailSaveButtonDisabled
                ]}
                onPress={isFoodDirty && !foodSaving ? handleUpdateFoodNutrients : undefined}
                disabled={!isFoodDirty || foodSaving}
              >
                <Text
                  style={[
                    styles.foodDetailSaveButtonText,
                    (!isFoodDirty || foodSaving) && styles.foodDetailSaveButtonTextDisabled
                  ]}
                >
                  {foodSaving ? "Saving changes" : "Save changes"}
                </Text>
              </TouchableOpacity>
              {foodSaveMessage && (
                <Text style={styles.foodDetailSaveMessage}>{foodSaveMessage}</Text>
              )}
            </View>

            <View style={styles.foodDetailMicros}>
              {selectedFoodItem.nutrients.fiber_g > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Fiber</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.fiber_g)}g
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.sodium_mg > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Sodium</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.sodium_mg)}mg
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.cholesterol_mg > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Cholesterol</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.cholesterol_mg)}mg
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.potassium_mg > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Potassium</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.potassium_mg)}mg
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.vitamin_c_mg > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Vitamin C</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.vitamin_c_mg)}mg
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.vitamin_a_mcg > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Vitamin A</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.vitamin_a_mcg)}mcg
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.vitamin_d_iu > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Vitamin D</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.vitamin_d_iu)}IU
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.magnesium_mg > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Magnesium</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.magnesium_mg)}mg
                  </Text>
                </View>
              )}
              {selectedFoodItem.nutrients.omega_3_g > 0 && (
                <View style={styles.foodDetailMicroRow}>
                  <Text style={styles.foodDetailMicroLabel}>Omega-3</Text>
                  <Text style={styles.foodDetailMicroValue}>
                    {Math.round(selectedFoodItem.nutrients.omega_3_g * 10) / 10}g
                  </Text>
                </View>
              )}
            </View>

          </View>

          {loadingInsights ? (
            <View style={styles.foodDetailLoading}>
              <Text style={styles.foodDetailLoadingText}>Loading insights...</Text>
            </View>
          ) : foodInsights ? (
            <>
              {foodInsights.healthQuotient > 0 && (() => {
                const { label, color } = getHealthQuotientLevel(foodInsights.healthQuotient);
                const topQualities = getTopQualities(selectedFoodItem.nutrients);
                return (
                <View style={styles.foodDetailHealthSection}>
                  <Text style={styles.foodDetailSectionTitle}>Health Quotient</Text>
                  <View style={styles.foodDetailHealthQuotient}>
                    <Text style={[styles.foodDetailHealthQuotientValue, { color }]}>
                      {label}
                    </Text>
                    {topQualities.length > 0 && (
                      <View style={styles.foodDetailHealthQualities}>
                        {topQualities.map((quality, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.foodDetailHealthQualityPill,
                              { backgroundColor: color }
                            ]}
                          >
                            <Text style={styles.foodDetailHealthQualityPillText}>
                              {quality}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                );
              })()}

              {foodInsights.insights && (
                <View style={styles.foodDetailSectionWrapper}>
                  <View style={styles.foodDetailSection}>
                    <Text style={styles.foodDetailSectionTitle}>Insights</Text>
                    <Text style={[styles.foodDetailInsights, !isPro && styles.proFeatureBlur]}>{foodInsights.insights}</Text>
                  </View>
                  {!isPro && (
                    <TouchableOpacity
                      style={styles.proFeatureOverlayContributors}
                      onPress={() => presentPaywall()}
                      activeOpacity={1}
                    >
                      <Text style={styles.proFeatureOverlayText}>Unlock food insights</Text>
                      <Text style={styles.proFeatureOverlaySubtext}>AI-powered tips and recommendations</Text>
                      <TouchableOpacity
                        style={styles.upgradeProButton}
                        onPress={() => presentPaywall()}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.upgradeProButtonText}>Upgrade to Pro</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {foodInsights.tips && foodInsights.tips.length > 0 && (
                <View style={styles.foodDetailSectionWrapper}>
                  <View style={styles.foodDetailSection}>
                    <Text style={styles.foodDetailSectionTitle}>Tips</Text>
                    <View style={!isPro && styles.proFeatureBlur}>
                      {foodInsights.tips.map((tip, idx) => (
                        <View key={idx} style={styles.foodDetailTip}>
                          <Text style={styles.foodDetailTipBullet}>•</Text>
                          <Text style={styles.foodDetailTipText}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {!isPro && (
                    <TouchableOpacity
                      style={styles.proFeatureOverlayContributors}
                      onPress={() => presentPaywall()}
                      activeOpacity={1}
                    >
                      <Text style={styles.proFeatureOverlayText}>Unlock food tips</Text>
                      <Text style={styles.proFeatureOverlaySubtext}>AI-powered tips and recommendations</Text>
                      <TouchableOpacity
                        style={styles.upgradeProButton}
                        onPress={() => presentPaywall()}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.upgradeProButtonText}>Upgrade to Pro</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (view === "meal" && selectedMealId) {
    const totalCalories = Math.round(
      selectedItems.reduce((sum, item) => sum + item.nutrients.calories_kcal, 0)
    );
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
        <SafeAreaView style={{ backgroundColor: "#F5F5F7" }}>
          <View style={styles.fixedHeader}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setView("home")}
            >
              <Text style={styles.iconText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{selectedMealLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.headerAddButton}
              onPress={() => {
                setEntryText("");
                setView("add");
              }}
            >
              <Text style={styles.headerAddText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mealDetailContent}>
          {selectedItems.map((item) => (
            <SwipeableItemCard
              key={item.id}
              item={item}
              onOpenDetail={async () => {
                setSelectedFoodItem(item);
                setEditableFoodNutrients(item.nutrients);
                setOriginalFoodNutrients(item.nutrients);
                fetchFoodInsights(item, selectedMealId);
              }}
              onDelete={() => handleDeleteItem(selectedMealId, item.id)}
              cardStyle={styles.itemCard}
              cardContent={
                <>
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.itemHeaderText}>
                      <Text
                        style={styles.itemTitle}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {capitalizeFirst(stripParenthetical(item.name))}
                      </Text>
                      <Text style={styles.itemSubtitle}>
                        {item.quantity} {item.unit}
                        {item.unit === "g" || item.unit === "ml"
                          ? ""
                          : `, ${Math.round(item.grams)}g`}
                      </Text>
                    </View>
                    <View style={styles.itemChevron}>
                      <Text style={styles.itemChevronText}>›</Text>
                    </View>
                  </View>
                  <View style={styles.itemMacros}>
                    <View style={styles.macroPill}>
                      <Text style={styles.macroText}>
                        {Math.round(item.nutrients.protein_g)}g Protein
                      </Text>
                    </View>
                    <View style={styles.macroPill}>
                      <Text style={styles.macroText}>
                        {Math.round(item.nutrients.carbs_g)}g Carbs
                      </Text>
                    </View>
                    <View style={styles.macroPill}>
                      <Text style={styles.macroText}>
                        {Math.round(item.nutrients.fat_g)}g Fat
                      </Text>
                    </View>
                    <Text style={styles.itemCalories}>
                      {Math.round(item.nutrients.calories_kcal)} Cal
                    </Text>
                  </View>
                </>
              }
            />
          ))}

          {selectedItems.length === 0 && (
            <Text style={styles.emptyText}>No items logged yet.</Text>
          )}

          {selectedItems.length > 0 && (
            <TouchableOpacity
              style={styles.saveTemplateButton}
              onPress={() => {
                const itemNames = selectedItems.map((item) => {
                  const baseName = capitalizeFirst(stripParenthetical(item.name)).trim();
                  if (item.grams && item.grams > 0) {
                    return `${Math.round(item.grams)}g ${baseName}`;
                  }
                  const qty = item.quantity ? String(item.quantity) : "";
                  const unit = item.unit || "";
                  const prefix = `${qty}${unit ? unit : ""}`.trim();
                  return prefix ? `${prefix} ${baseName}` : baseName;
                });
                setEntryText(itemNames.join("\n"));
                setTemplateName(`${selectedMealLabel} - ${new Date().toLocaleDateString()}`);
                setEditingTemplateId(null); // New template
                setIsTemplateMode(true);
                setView("add");
              }}
            >
              <Text style={styles.saveTemplateText}>Save as template</Text>
            </TouchableOpacity>
          )}
        </ScrollView>


        <TouchableOpacity style={styles.doneButton} onPress={() => setView("home")}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleExportRangeChange = (range: "7" | "30" | "custom") => {
    setExportRange(range);
    if (range === "7") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setExportStartDate(toDateKey(d));
      setExportEndDate(toDateKey(new Date()));
    } else if (range === "30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setExportStartDate(toDateKey(d));
      setExportEndDate(toDateKey(new Date()));
    }
  };

  const handleExportPDF = async () => {
    setLoading(true);
    setError(null);

    try {
      // Collect data for the date range
      const dates: string[] = [];
      let current = exportStartDate;
      while (current <= exportEndDate) {
        dates.push(current);
        current = addDays(current, 1);
      }

      const exportData = dates.map((date) => ({
        date,
        data: getDayData(date)
      }));

      // Generate HTML content
      let htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                size: letter;
                margin: 0;
              }
              body { 
                font-family: Arial, sans-serif; 
                padding: 0;
                margin: 0;
              }
              .page {
                width: 100%;
                min-height: 792px;
                padding: 40px 20px;
                margin: 0;
                page-break-after: always;
                break-after: page;
                box-sizing: border-box;
              }
              .page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
              h1 { color: #111827; margin-bottom: 10px; margin-top: 0; }
              h2 { color: #1F2937; margin-top: 20px; margin-bottom: 10px; }
              .day-section { 
                margin-bottom: 30px; 
                border-bottom: 1px solid #E5E7EB; 
                padding-bottom: 20px; 
              }
              .meal-section { margin: 15px 0; }
              .meal-title { font-weight: bold; color: #111827; margin-bottom: 8px; }
              .item { margin: 5px 0; padding-left: 15px; }
              .nutrition { margin-top: 10px; color: #6B7280; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #E5E7EB; }
              th { background-color: #F3F4F6; font-weight: bold; }
              .summary { color: #6B7280; margin-bottom: 20px; }
            </style>
          </head>
          <body>
      `;

      exportData.forEach(({ date, data }) => {
        const dayTotals = data.meals.reduce(
          (acc, meal) => sumTotals(acc, meal.nutrients),
          emptyTotals()
        );

        if (dayTotals.calories_kcal > 0) {
          const microTotals = getMicroTotalsFromItems(data.mealItems);
          
          // Each date gets its own page
          htmlContent += `
            <div class="page">
              <h1>Meal Tracking Export</h1>
              <p class="summary">Date Range: ${formatHeaderLabel(exportStartDate)} to ${formatHeaderLabel(exportEndDate)}</p>
              <div class="day-section">
                <h2>${formatHeaderLabel(date)}</h2>
              <div class="nutrition">
                <table>
                  <tr><th>Nutrient</th><th>Value</th></tr>
                  <tr><td>Calories</td><td>${Math.round(dayTotals.calories_kcal)} kcal</td></tr>
                  <tr><td>Protein</td><td>${Math.round(dayTotals.protein_g)}g</td></tr>
                  <tr><td>Carbs</td><td>${Math.round(dayTotals.carbs_g)}g</td></tr>
                  <tr><td>Fat</td><td>${Math.round(dayTotals.fat_g)}g</td></tr>
                  ${ANALYSIS_MICROS.map(({ label, unit, key }) => {
                    const raw = key ? (microTotals[key] ?? 0) : 0;
                    const disp = microDisplayValue(key, raw, unit);
                    const fmt = Number.isInteger(disp) ? disp : Math.round(disp * 10) / 10;
                    return `<tr><td>${label}</td><td>${fmt}${unit}</td></tr>`;
                  }).join("")}
                </table>
              </div>
          `;

          data.meals.forEach((meal) => {
            const items = data.mealItems[meal.id] || [];
            if (items.length > 0) {
              htmlContent += `
                <div class="meal-section">
                  <div class="meal-title">${meal.label}</div>
              `;
              items.forEach((item) => {
                htmlContent += `
                  <div class="item">• ${capitalizeFirst(stripParenthetical(item.name))} - ${item.quantity} ${item.unit}</div>
                `;
              });
              htmlContent += `</div>`;
            }
          });

          htmlContent += `
              </div>
            </div>
          `;
        }
      });

      htmlContent += `
          </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        width: 612, // US Letter width in points (8.5 inches)
        height: 792, // US Letter height in points (11 inches)
      });

      // Generate filename with date range
      const filename = `Joul-export-${exportStartDate}-to-${exportEndDate}.pdf`;
      const documentDir = FileSystem.documentDirectory || "";
      const newUri = documentDir ? `${documentDir}${filename}` : uri;

      // Copy file to document directory with proper name
      if (FileSystem.documentDirectory) {
        // Delete old file if it exists
        try {
          const fileInfo = await FileSystem.getInfoAsync(newUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(newUri, { idempotent: true });
          }
        } catch (e) {
          // Ignore errors
        }
        
        // Copy to new location with correct name
        await FileSystem.copyAsync({
          from: uri,
          to: newUri
        });
      }

      // Share/save the PDF
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(FileSystem.documentDirectory ? newUri : uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save Meal Tracking Export",
          UTI: "com.adobe.pdf"
        });
        setError(null);
      } else {
        setError("Sharing is not available on this device.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  if (view === "export") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.addHeader}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setView("home")}>
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Export Data</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.exportContent}>
          <Text style={styles.sectionLabel}>SELECT DATE RANGE</Text>

          <TouchableOpacity
            style={[
              styles.exportOption,
              exportRange === "7" && styles.exportOptionSelected
            ]}
            onPress={() => handleExportRangeChange("7")}
          >
            <Text
              style={[
                styles.exportOptionText,
                exportRange === "7" && styles.exportOptionTextSelected
              ]}
            >
              Last 7 days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.exportOption,
              exportRange === "30" && styles.exportOptionSelected
            ]}
            onPress={() => handleExportRangeChange("30")}
          >
            <Text
              style={[
                styles.exportOptionText,
                exportRange === "30" && styles.exportOptionTextSelected
              ]}
            >
              Last 30 days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.exportOption,
              exportRange === "custom" && styles.exportOptionSelected
            ]}
            onPress={() => setExportRange("custom")}
          >
            <Text
              style={[
                styles.exportOptionText,
                exportRange === "custom" && styles.exportOptionTextSelected
              ]}
            >
              Custom range
            </Text>
          </TouchableOpacity>

          {exportRange === "custom" && (
            <View style={styles.customRangeContainer}>
              <View style={styles.dateInputRow}>
                <Text style={styles.dateLabel}>From:</Text>
                <TextInput
                  style={styles.dateInput}
                  value={exportStartDate}
                  onChangeText={setExportStartDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.dateInputRow}>
                <Text style={styles.dateLabel}>To:</Text>
                <TextInput
                  style={styles.dateInput}
                  value={exportEndDate}
                  onChangeText={setExportEndDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
          )}

          <Text style={styles.exportInfo}>
            Exporting from {formatHeaderLabel(exportStartDate)} to{" "}
            {formatHeaderLabel(exportEndDate)}
          </Text>

          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportPDF}
            disabled={loading}
          >
            <Text style={styles.exportButtonText}>
              {loading ? "Exporting..." : "Export to PDF"}
            </Text>
          </TouchableOpacity>

          {error ? <Text style={styles.addError}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show loading screen while app is initializing
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Image 
            source={require("./assets/loading-screen.png")}
            style={{ width: "100%", height: "100%", resizeMode: "contain" }}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity
            style={[styles.iconButton, styles.menuIconButton]}
            onPress={() => setMenuVisible(true)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          {activeTab === "insights" ? (
            <Text style={styles.headerTitle}>Insights</Text>
          ) : (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={goToPrevDay}>
                <Text style={styles.iconText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {hydrated ? formatHeaderLabel(selectedDate) : "Today"}
              </Text>
              <TouchableOpacity
                style={[styles.iconButton, !canGoNext && styles.iconButtonDisabled]}
                onPress={goToNextDay}
                disabled={!canGoNext}
              >
                <Text style={[styles.iconText, !canGoNext && styles.iconTextDisabled]}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <View style={styles.headerRightContainer}>
          {!isPro && (
            <TouchableOpacity
              style={styles.headerUpgradeButton}
              onPress={() => presentPaywall()}
              activeOpacity={0.8}
            >
              <Text
                style={styles.headerUpgradeButtonText}
                numberOfLines={1}
                ellipsizeMode="clip"
                allowFontScaling={false}
              >
                Upgrade
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeSidebar}
      >
        <View style={styles.sidebarRoot}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, styles.sidebarOverlay]}
            activeOpacity={1}
            onPress={closeSidebar}
          />
          <Animated.View
            style={[
              styles.sidebar,
              { width: SIDEBAR_WIDTH, transform: [{ translateX: sidebarAnim }] },
            ]}
          >
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Menu</Text>
              <TouchableOpacity
                style={styles.sidebarCloseButton}
                onPress={closeSidebar}
              >
                <Text style={styles.sidebarCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeSidebar();
                setTimeout(() => presentCustomerCenter(), 220);
              }}
            >
              <Text style={styles.menuItemText}>Manage Subscription</Text>
            </TouchableOpacity>
            {/* DEBUG: Reset subscription for testing - REMOVE BEFORE PRODUCTION */}
            <TouchableOpacity
              style={[styles.menuItem, styles.debugMenuItem]}
              onPress={async () => {
                console.log("Reset button pressed");
                closeSidebar();
                try {
                  await resetSubscriptionForTesting();
                  console.log("Reset function completed");
                } catch (err) {
                  console.error("Reset button error:", err);
                  // Force state update even if reset fails
                  alert("Reset completed. Check console for details.");
                }
              }}
            >
              <Text style={[styles.menuItemText, styles.debugMenuItemText]}>🔧 Reset Subscription (Testing)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeSidebar();
                setTimeout(() => setView("savedFoods"), 220);
              }}
            >
              <Text style={styles.menuItemText}>Saved foods</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeSidebar();
                setTimeout(() => setView("personal"), 220);
              }}
            >
              <Text style={styles.menuItemText}>Personal details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeSidebar();
                setTimeout(() => setView("export"), 220);
              }}
            >
              <Text style={styles.menuItemText}>Export</Text>
              {!isPro && (
                <Image
                  source={require("./assets/Pro_Badge.png")}
                  style={styles.menuProBadge}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeSidebar();
                setTimeout(() => {
                  setFeedbackRating(0);
                  setFeedbackText("");
                  setFeedbackModalVisible(true);
                }, 220);
              }}
            >
              <Text style={styles.menuItemText}>Share feedback</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={feedbackModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.feedbackModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.feedbackModalContent}>
            <View style={styles.feedbackModalHeader}>
              <View style={styles.feedbackModalTitleWrap}>
                <Text style={styles.feedbackModalTitle}>How are we doing?</Text>
              </View>
              <TouchableOpacity
                style={styles.feedbackModalCloseButton}
                onPress={() => {
                  setFeedbackModalVisible(false);
                  setFeedbackRating(0);
                  setFeedbackText("");
                }}
              >
                <Text style={styles.feedbackModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.feedbackModalSubtext}>
              Your opinion means a world to us.
            </Text>
            <View style={styles.feedbackStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setFeedbackRating(star)}
                  style={styles.feedbackStarButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.feedbackStarIcon}>
                    {star <= feedbackRating ? "★" : "☆"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.feedbackTextInput}
              placeholder="Share your thoughts with us..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              value={feedbackText}
              onChangeText={(t) => setFeedbackText(t)}
              textAlignVertical="top"
              editable
            />
            <TouchableOpacity
              style={[
                styles.feedbackSubmitButton,
                feedbackRating < 1 && styles.feedbackSubmitButtonDisabled
              ]}
              onPress={async () => {
                if (feedbackRating >= 1) {
                  try {
                    const res = await fetch(`${API_BASE_URL}/feedback`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        rating: feedbackRating,
                        text: feedbackText.trim() || undefined
                      })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      console.warn("Feedback submit failed:", res.status, err);
                    }
                  } catch (err) {
                    console.warn("Feedback submit error:", err);
                  }
                  setFeedbackModalVisible(false);
                  setFeedbackRating(0);
                  setFeedbackText("");
                }
              }}
              disabled={feedbackRating < 1}
              activeOpacity={0.8}
            >
              <Text style={styles.feedbackSubmitButtonText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.feedbackSkipButton}
              onPress={() => {
                setFeedbackModalVisible(false);
                setFeedbackRating(0);
                setFeedbackText("");
              }}
            >
              <Text style={styles.feedbackSkipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.mealsSwipeArea} {...((activeTab === "meals" || activeTab === "analysis") ? mealsSwipeResponder.panHandlers : {})}>
        {activeTab === "meals" && (
          <Animated.View
            style={[
              { flex: 1 },
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <ScrollView
              style={{ flex: 1, backgroundColor: "#F5F5F7" }}
              contentContainerStyle={styles.content}
            >
            <TouchableOpacity
              onPress={() => setActiveTab("analysis")}
              activeOpacity={1}
            >
              <Text style={styles.sectionLabel}>NUTRITION</Text>
              <View style={styles.nutritionCard}>
                {(() => {
                  const macroTargets = getMacroTargets(userProfile);
                  const items = [
                    { key: "calories_kcal" as const, label: "Calories", value: totals.calories_kcal, target: macroTargets.calories_kcal, unit: "" },
                    { key: "protein_g" as const, label: "Protein", value: totals.protein_g, target: macroTargets.protein_g, unit: "g" },
                    { key: "carbs_g" as const, label: "Carbs", value: totals.carbs_g, target: macroTargets.carbs_g, unit: "g" },
                    { key: "fat_g" as const, label: "Fat", value: totals.fat_g, target: macroTargets.fat_g, unit: "g" }
                  ];
                  return items.map((item) => {
                    const current = Number(item.value) || 0;
                    const target = Number(item.target) || 1;
                    const progress = target > 0 ? Math.min(1, current / target) : 0;
                    return (
                      <View key={item.key} style={styles.nutritionItem}>
                        <View style={styles.nutritionLabelWrap}>
                          <Text style={styles.nutritionLabel}>{item.label}</Text>
                        </View>
                        <CircularProgressRing
                          progress={progress}
                          value={current}
                          size={72}
                          suffix={item.unit}
                        />
                        <View style={styles.nutritionTargetWrap}>
                          <Text style={styles.nutritionTarget}>
                            / {Math.round(target)}
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
            </TouchableOpacity>

            {shouldShowInsight && bestInsight && (
              <View style={styles.yesterdayInsightCard}>
                <View style={styles.yesterdayInsightHeader}>
                  <Text style={styles.yesterdayInsightDate}>Yesterday</Text>
                  <TouchableOpacity onPress={handleDismissInsight} style={styles.yesterdayInsightDismiss}>
                    <Text style={styles.yesterdayInsightDismissText}>✕</Text>
                  </TouchableOpacity>
                </View>
                {isPro ? (
                  <>
                    <Text style={styles.yesterdayInsightAffirmation}>{bestInsight.affirmation}</Text>
                    <Text style={styles.yesterdayInsightCategory}>{bestInsight.category}</Text>
                    <Text style={styles.yesterdayInsightValue}>{bestInsight.value}</Text>
                    <Text style={styles.yesterdayInsightMessage}>{bestInsight.message}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.yesterdayInsightAffirmation}>{bestInsight.affirmation}</Text>
                    <Text style={styles.yesterdayInsightCategory}>{bestInsight.category}</Text>
                    <Text style={styles.yesterdayInsightValue}>{bestInsight.value}</Text>
                    <TouchableOpacity
                      style={styles.upgradeProButton}
                      onPress={() => presentPaywall()}
                    >
                      <Text style={styles.upgradeProButtonText}>Upgrade to view full insights</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <Text style={[styles.sectionLabel, styles.sectionSpacing]}>MEALS</Text>
            <View style={styles.mealsList}>
              {meals.map((meal) => {
                const mealItemsForMeal = mealItems[meal.id] || [];
                const hasItems = mealItemsForMeal.length > 0 || meal.nutrients.calories_kcal > 0;
                const iconSource = hasItems ? MEAL_ICON_COLORED : MEAL_ICON_GRAYSCALE;
                const iconSize = meal.id === "snack-afternoon" || meal.id === "snack-evening" ? 36 : 40;
                
                return (
                <PressableCard
                  key={meal.id}
                  style={styles.mealCard}
                  onPress={() => {
                    setSelectedMealId(meal.id);
                    setView("meal");
                  }}
                >
                  <View style={styles.mealIcon}>
                    <Image
                      source={iconSource}
                      style={{
                        width: iconSize,
                        height: iconSize,
                        resizeMode: "contain"
                      }}
                    />
                  </View>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealLabel}>{meal.label}</Text>
                    {meal.nutrients.calories_kcal > 0 ? (
                      <Text style={styles.mealCalories}>
                        {Math.round(meal.nutrients.calories_kcal)} Cal
                      </Text>
                    ) : null}
                    {(meal.nutrients.protein_g > 0 || meal.nutrients.carbs_g > 0 || meal.nutrients.fat_g > 0) ? (
                      <View style={styles.mealMacros}>
                        <View style={styles.macroPill}>
                          <Text style={styles.macroText}>
                            {Math.round(meal.nutrients.protein_g)}g Protein
                          </Text>
                        </View>
                        <View style={styles.macroPill}>
                          <Text style={styles.macroText}>
                            {Math.round(meal.nutrients.carbs_g)}g Carbs
                          </Text>
                        </View>
                        <View style={styles.macroPill}>
                          <Text style={styles.macroText}>
                            {Math.round(meal.nutrients.fat_g)}g Fat
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.addCircle}
                    onPress={() => openAdd(meal.id)}
                  >
                    <Text style={styles.addCircleText}>+</Text>
                  </TouchableOpacity>
                </PressableCard>
                );
              })}
            </View>
          </ScrollView>
          </Animated.View>
        )}

        {activeTab === "analysis" && (
          <Animated.View
            style={[
              { flex: 1 },
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {selectedNutrient === null ? (
            <ScrollView
              style={{ flex: 1, backgroundColor: "#F5F5F7" }}
              contentContainerStyle={styles.analysisContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.sectionLabel}>NUTRIENTS</Text>
              <View style={styles.analysisMacroList}>
                {(() => {
                  const macroTargets = getMacroTargets(userProfile);
                  const ANALYSIS_MACROS = [
                    { key: "calories_kcal" as const, label: "Calories", unit: "kcal", target: macroTargets.calories_kcal },
                    { key: "protein_g" as const, label: "Protein", unit: "g", target: macroTargets.protein_g },
                    { key: "carbs_g" as const, label: "Carbs", unit: "g", target: macroTargets.carbs_g },
                    { key: "fat_g" as const, label: "Fat", unit: "g", target: macroTargets.fat_g }
                  ];
                  return ANALYSIS_MACROS.map(({ key, label, unit, target }) => {
                    const current = Number(analysisTotals[key]) || 0;
                    const progress = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
                    return (
                      <TouchableOpacity
                        key={key}
                    style={styles.analysisMacroCard}
                        onPress={() => {
                          setSelectedNutrient({
                            type: "macro",
                            key,
                            label,
                            unit,
                            target
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.analysisMacroContent}>
                          <View style={styles.analysisMacroHeaderRow}>
                            <Text style={styles.analysisMacroName}>{label} ({unit})</Text>
                            <View style={styles.analysisMacroHeaderRight}>
                              <Text style={styles.analysisMacroCurrent}>
                                {Math.round(current)}
                              </Text>
                              <Text style={styles.analysisMacroSlashTarget}>
                                {" "}
                                / {Math.round(target)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.analysisMacroProgressBar}>
                            <View
                              style={[
                                styles.analysisMacroProgressFill,
                                { width: `${Math.min(100, progress * 100)}%` }
                              ]}
                            />
                          </View>
                        </View>
                        <View style={styles.analysisMacroChevronWrap}>
                          <Text style={styles.analysisMacroChevron}>›</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              <View style={[styles.sectionLabelContainer, styles.sectionSpacing]}>
                <Text style={[styles.sectionLabel, styles.sectionLabelInRow]}>
                  MICRO-NUTRIENTS
                </Text>
                {!isPro && (
                  <Image
                    source={require("./assets/Pro_Badge.png")}
                    style={styles.sectionProBadge}
                    resizeMode="contain"
                  />
                )}
              </View>
              <View style={styles.analysisMicroGridWrapper}>
              <View style={[styles.analysisMicroGrid, !isPro && styles.proFeatureBlur]}>
                {ANALYSIS_MICROS.map(({ label, unit, target, key }) => {
                  const raw = key ? (analysisMicroTotals[key] ?? 0) : 0;
                  const safeRaw = Number(raw) || 0;
                  const current = microDisplayValue(key, safeRaw, unit);
                  const safeCurrent = Number(current) || 0;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={styles.analysisMicroCard}
                      onPress={async () => {
                        if (!isPro) {
                          await presentPaywall();
                          return;
                        }
                        setSelectedNutrient({
                          type: "micro",
                          label,
                          unit,
                          target,
                          ...(key ? { key } : {})
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.analysisMicroName}>{label}</Text>
                      <View style={styles.analysisMicroValues}>
                        <Text style={styles.analysisMicroCurrent}>
                          {key ? Math.round(safeCurrent) : safeCurrent}
                          {unit}
                        </Text>
                        <Text style={styles.analysisMicroTarget}>
                          / {target}
                          {unit}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!isPro && (
                <TouchableOpacity
                  style={styles.proFeatureOverlay}
                  onPress={() => presentPaywall()}
                  activeOpacity={1}
                >
                  <Text style={styles.proFeatureOverlayText}>Unlock micronutrient tracking</Text>
                  <Text style={styles.proFeatureOverlaySubtext}>See daily goals and progress for micros like Fiber, Cholesterol</Text>
                  <TouchableOpacity
                    style={styles.upgradeProButton}
                    onPress={() => presentPaywall()}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.upgradeProButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              </View>
            </ScrollView>
            ) : (
          <>
            <SafeAreaView style={{ backgroundColor: "#F5F5F7" }}>
              <View style={styles.fixedHeader}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setSelectedNutrient(null)}
                >
                  <Text style={styles.iconText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>
                    {selectedNutrient.label.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.iconButton} />
              </View>
            </SafeAreaView>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.nutrientDetailContent}
              showsVerticalScrollIndicator
            >

            <Text style={styles.nutrientDetailExplanation}>
              {NUTRIENT_EXPLANATIONS[selectedNutrient.label] ??
                `${selectedNutrient.label} supports overall health; target is based on general guidelines.`}
            </Text>

            {(() => {
              const raw =
                selectedNutrient.type === "macro"
                  ? (analysisTotals[selectedNutrient.key] ?? 0)
                  : selectedNutrient.type === "micro" && selectedNutrient.key
                    ? (analysisMicroTotals[selectedNutrient.key] ?? 0)
                    : 0;
              const safeRaw = Number(raw) || 0;
              const { target, unit } = selectedNutrient;
              const key = selectedNutrient.type === "micro" ? selectedNutrient.key : undefined;
              const current = key ? microDisplayValue(key, safeRaw, unit) : safeRaw;
              const safeCurrent = Number(current) || 0;
              const pct =
                target > 0 ? Math.round((safeCurrent / target) * 100) : 0;
              return (
                <Text style={styles.nutrientDetailProgress}>
                  {Math.round(safeCurrent)}
                  {unit} today ({Number.isFinite(pct) ? pct : 0}% of your goal)
                </Text>
              );
            })()}

            <View style={styles.nutrientDetailContributorsLabelContainer}>
              <Text style={styles.nutrientDetailContributorsLabel}>
                Contributors
              </Text>
              {!isPro && (
                <Image
                  source={require("./assets/Pro_Badge.png")}
                  style={styles.contributorsProBadge}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.nutrientDetailContributorsWrapper}>
              {(() => {
                const contributors = getContributors(
                  selectedNutrient,
                  analysisMealItems,
                  analysisTotals
                );
                if (contributors.length === 0) {
                  return (
                    <Text style={styles.nutrientDetailEmpty}>
                      No logged foods contribute to this nutrient yet.
                    </Text>
                  );
                }
                const key = selectedNutrient.type === "micro" ? selectedNutrient.key : undefined;
                const u = selectedNutrient.unit;
                return (
                  <View style={[styles.nutrientDetailContributors, !isPro && styles.proFeatureBlur]}>
                    {contributors.map(({ name, amount }, idx) => {
                      const safeAmount = Number(amount) || 0;
                      const displayAmt = key ? microDisplayValue(key, safeAmount, u) : safeAmount;
                      const safeDisplayAmt = Number(displayAmt) || 0;
                      return (
                      <View
                        key={name + String(idx)}
                        style={[
                          styles.nutrientDetailRow,
                          idx === contributors.length - 1 &&
                            styles.nutrientDetailRowLast
                        ]}
                      >
                        <Text
                          style={styles.nutrientDetailRowName}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {name}
                        </Text>
                        <Text style={styles.nutrientDetailRowAmount}>
                          {Math.round(safeDisplayAmt)}
                          {u}
                        </Text>
                      </View>
                      );
                    })}
                  </View>
                );
              })()}
              {!isPro && (
                <TouchableOpacity
                  style={styles.proFeatureOverlayContributors}
                  onPress={() => presentPaywall()}
                  activeOpacity={1}
                >
                  <Text style={styles.proFeatureOverlayText}>Unlock contributors list</Text>
                  <Text style={styles.proFeatureOverlaySubtext}>See which foods contribute to this nutrient</Text>
                  <TouchableOpacity
                    style={styles.upgradeProButton}
                    onPress={() => presentPaywall()}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.upgradeProButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            </View>
            </ScrollView>
          </>
            )}
          </Animated.View>
        )}

        {activeTab === "insights" && (
          <View style={styles.insightsRoot}>
          {!isPro && (
            <TouchableOpacity
              style={styles.proFeatureFullOverlay}
              onPress={() => presentPaywall()}
              activeOpacity={1}
            >
              <View style={styles.insightsPaywallCard}>
                <View style={styles.insightsPaywallProBadge}>
                  <Text style={styles.insightsPaywallProBadgeText}>PRO</Text>
                </View>

                <View style={styles.insightsPaywallLogoRow}>
                  <Image
                    source={require("./assets/Logo.png")}
                    style={styles.insightsPaywallLogoImage}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.insightsPaywallHeadline}>
                  UNLOCK PERSONALIZED{"\n"}INSIGHTS WITH PRO
                </Text>
                <Text style={styles.insightsPaywallBody}>
                  AI-powered tips and recommendations
                </Text>

                <View style={styles.insightsPaywallSpacer} />

                <Text style={styles.insightsPaywallTrialText}>
                  Start a 7-day free trial
                </Text>

                <TouchableOpacity
                  style={styles.insightsPaywallPrimaryButton}
                  onPress={() => presentPaywall()}
                  activeOpacity={0.9}
                >
                  <Text style={styles.insightsPaywallPrimaryButtonText}>Upgrade to Pro</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
            <View style={styles.insightsSubTabsContainer}>
              <View style={styles.insightsSubTabs}>
                <TouchableOpacity
                  style={[styles.insightsSubTab, insightsSubTab === "day" && styles.insightsSubTabActive]}
                  onPress={() => setInsightsSubTab("day")}
                >
                  <Text style={[styles.insightsSubTabLabel, insightsSubTab === "day" && styles.insightsSubTabLabelActive]}>
                    Day
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.insightsSubTab, insightsSubTab === "week" && styles.insightsSubTabActive]}
                  onPress={() => setInsightsSubTab("week")}
                >
                  <Text style={[styles.insightsSubTabLabel, insightsSubTab === "week" && styles.insightsSubTabLabelActive]}>
                    Week
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.insightsContent}
              showsVerticalScrollIndicator
            >
              {insightsSubTab === "day" ? (() => {
                const past = getPastDatesWithMeals(dataByDate, todayKey);
                if (past.length === 0) {
                  return (
                    <Text style={styles.insightsEmpty} selectable>
                      No past days with logged meals yet. Log meals on the Meals tab to see insights here.
                    </Text>
                  );
                }
                return past.map((dateKey) => {
                  const dayData = getDayData(dateKey);
                  const { summary, tips } = getDayInsights(dayData, userProfile);
                  const title = `Insights for ${formatHeaderLabel(dateKey)}`;
                  return (
                    <View key={dateKey} style={styles.insightsCard}>
                      <Text style={styles.insightsCardTitle} selectable>{title}</Text>
                      <Text style={styles.insightsCardSummary} selectable>{summary}</Text>
                      {tips.length > 0 && (
                        <View style={styles.insightsTips}>
                          <Text style={styles.insightsTipsTitle} selectable>TIPS</Text>
                          <View style={styles.insightsTipsDivider} />
                          {tips.map((t, i) => renderInsightTip(t, i, styles.insightsTipItem))}
                        </View>
                      )}
                    </View>
                  );
                });
              })() : (() => {
                const { daysWithMeals } = aggregateWeekData(dataByDate, todayKey);
                const { summary, tips } = getWeekInsights(dataByDate, todayKey, userProfile);
                if (daysWithMeals === 0) {
                  return (
                    <Text style={styles.insightsEmpty} selectable>
                      No meals logged in the past 7 days. Log meals on the Meals tab to see weekly insights.
                    </Text>
                  );
                }
                return (
                  <View style={styles.insightsCard}>
                    <Text style={styles.insightsCardTitle} selectable>Insights for the week</Text>
                    <Text style={styles.insightsCardSummary} selectable>{summary}</Text>
                    {tips.length > 0 && (
                      <View style={styles.insightsTips}>
                        <Text style={styles.insightsTipsTitle} selectable>TIPS</Text>
                        <View style={styles.insightsTipsDivider} />
                        {tips.map((t, i) => renderInsightTip(t, i, styles.insightsTipItem))}
                      </View>
                    )}
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("meals")}
          activeOpacity={0.8}
        >
          <View style={styles.tabIconWrap}>
            <TabIcon
              source={
                activeTab === "meals"
                  ? require("./assets/Meals-active.png")
                  : require("./assets/Meals-inactive.png")
              }
              size={28}
            />
          </View>
          <Text
            style={[styles.tabLabel, activeTab === "meals" && styles.tabLabelActive]}
          >
            MEALS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("analysis")}
          activeOpacity={0.8}
        >
          <View style={styles.tabIconWrap}>
            <TabIcon
              source={
                activeTab === "analysis"
                  ? require("./assets/Analysis-active.png")
                  : require("./assets/Analysis-inactive.png")
              }
              size={28}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "analysis" && styles.tabLabelActive
            ]}
          >
            ANALYSIS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("insights")}
          activeOpacity={0.8}
        >
          <View style={styles.tabIconWrap}>
            <TabIcon
              source={
                activeTab === "insights"
                  ? require("./assets/Insights-active.png")
                  : require("./assets/Insights-inactive.png")
              }
              size={28}
            />
          </View>
          <View style={styles.tabLabelContainer}>
            <Text
              style={[
                styles.tabLabel,
                activeTab === "insights" && styles.tabLabelActive
              ]}
            >
              INSIGHTS
            </Text>
            {!isPro && (
              <Image
                source={require("./assets/Pro_Badge.png")}
                style={styles.tabProBadge}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SubscriptionProvider>
      <AppContent />
    </SubscriptionProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    paddingTop: 10
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F7",
    width: "100%",
    height: "100%"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: HEADER_TO_CONTENT_GAP,
    paddingHorizontal: 12
  },
  fixedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: HEADER_TO_CONTENT_GAP,
    paddingHorizontal: 12,
    backgroundColor: "#F5F5F7"
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginHorizontal: 8
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  headerRightContainer: {
    width: 100,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0
  },
  headerUpgradeButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: "#2563EB",
    borderRadius: 14
  },
  headerUpgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600"
  },
  headerAddButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#2563EB",
    borderRadius: 20
  },
  headerAddText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600"
  },
  iconButtonDisabled: {
    opacity: 0.4
  },
  iconText: {
    fontSize: 20,
    color: "#1F2937"
  },
  iconTextDisabled: {
    color: "#9CA3AF"
  },
  menuIcon: {
    fontSize: 20,
    color: "#1F2937",
    fontWeight: "400"
  },
  headerLeftContainer: {
    width: 100,
    alignItems: "flex-start",
    justifyContent: "center"
  },
  menuIconButton: {
    alignItems: "flex-start",
    marginLeft: 0
  },
  sidebarRoot: {
    flex: 1
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingTop: 56,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8,
    zIndex: 1
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: "400",
    color: "#111827"
  },
  sidebarCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F3F4F6"
  },
  sidebarCloseText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "400"
  },
  sidebarOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.4)"
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  menuItemText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "400"
  },
  debugMenuItem: {
    backgroundColor: "#FEF3C7",
    borderBottomColor: "#FCD34D"
  },
  debugMenuItemText: {
    color: "#92400E",
    fontWeight: "500"
  },
  savedFoodsSearchWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12
  },
  savedFoodsSearchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  savedFoodsListContent: {
    paddingHorizontal: 12,
    paddingBottom: 24
  },
  savedFoodsEmpty: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
    marginTop: 32,
    paddingHorizontal: 24
  },
  savedFoodsRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  savedFoodsRowTop: {
    flexDirection: "row",
    alignItems: "center"
  },
  savedFoodsRowLeft: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center"
  },
  savedFoodsRowName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2
  },
  savedFoodsRowCalories: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "400"
  },
  savedFoodsRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  savedFoodsActionButton: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  savedFoodsActionIconImage: {
    width: 24,
    height: 24
  },
  savedFoodsDeleteConfirm: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB"
  },
  savedFoodsDeleteConfirmText: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 10
  },
  savedFoodsDeleteConfirmActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end"
  },
  savedFoodsDeleteConfirmCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F3F4F6"
  },
  savedFoodsDeleteConfirmCancelText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500"
  },
  savedFoodsDeleteConfirmOk: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626"
  },
  savedFoodsDeleteConfirmOkText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600"
  },
  savedFoodsEditModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  savedFoodsEditModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360
  },
  savedFoodsEditModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20
  },
  savedFoodsEditModalLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 6
  },
  savedFoodsEditModalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16
  },
  savedFoodsEditModalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 8
  },
  savedFoodsEditModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#F3F4F6"
  },
  savedFoodsEditModalCancelText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500"
  },
  savedFoodsEditModalSave: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#2563EB"
  },
  savedFoodsEditModalSaveText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600"
  },
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  feedbackModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 40
  },
  feedbackModalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    position: "relative"
  },
  feedbackModalTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  feedbackModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center"
  },
  feedbackModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 0,
    top: 0
  },
  feedbackModalCloseText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600"
  },
  feedbackModalSubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20
  },
  feedbackStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20
  },
  feedbackStarButton: {
    padding: 4,
    marginHorizontal: 4
  },
  feedbackStarIcon: {
    fontSize: 24,
    color: "#FBBF24"
  },
  feedbackTextInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#111827",
    minHeight: 140,
    marginBottom: 20
  },
  feedbackSubmitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12
  },
  feedbackSubmitButtonDisabled: {
    backgroundColor: "#D1D5DB",
    opacity: 0.7
  },
  feedbackSubmitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  feedbackSkipButton: {
    alignItems: "center",
    paddingVertical: 8
  },
  feedbackSkipButtonText: {
    fontSize: 14,
    color: "#6B7280"
  },
  mealsSwipeArea: {
    flex: 1,
    backgroundColor: "#F5F5F7"
  },
  content: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 100,
    paddingHorizontal: 12,
    backgroundColor: "#F5F5F7"
  },
  mealDetailContent: {
    paddingTop: HEADER_TO_CONTENT_GAP,
    paddingBottom: 120,
    paddingHorizontal: 12
  },
  sectionLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  sectionLabel: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0,
    marginBottom: 10
  },
  sectionLabelInRow: {
    marginBottom: 0
  },
  sectionProBadge: {
    width: 40,
    height: 20,
    alignSelf: "center"
  },
  menuProBadge: {
    width: 40,
    height: 20
  },
  sectionSpacing: {
    marginTop: 24
  },
  nutritionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1
  },
  nutritionLabelWrap: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  nutritionLabel: {
    color: "#333333",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center"
  },
  nutritionValue: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16
  },
  nutritionTargetWrap: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8
  },
  nutritionTarget: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "400",
    textAlign: "center"
  },
  upgradeProButton: {
    alignSelf: "center",
    marginTop: 12,
    backgroundColor: "#2563EB",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  upgradeProButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600"
  },
  proFeatureBlur: {
    opacity: 0.4
  },
  analysisMicroGridWrapper: {
    position: "relative",
    minHeight: 80
  },
  proFeatureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12
  },
  proFeatureOverlayContributors: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "flex-start",
    alignItems: "center",
    borderRadius: 12,
    paddingTop: 32
  },
  proFeatureOverlayText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4
  },
  proFeatureOverlaySubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    textAlign: "center"
  },
  proFeatureFullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 1
  },
  insightsPaywallCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
    alignItems: "center"
  },
  insightsPaywallProBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    marginBottom: 18
  },
  insightsPaywallProBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1
  },
  insightsPaywallLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20
  },
  insightsPaywallLogoImage: {
    width: 140,
    height: 40
  },
  insightsPaywallHeadline: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    letterSpacing: 0.5
  },
  insightsPaywallBody: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563"
  },
  insightsPaywallSpacer: {
    height: 20
  },
  insightsPaywallTrialText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10
  },
  insightsPaywallPrimaryButton: {
    alignSelf: "stretch",
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16
  },
  insightsPaywallPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600"
  },
  insightsPaywallSecondaryText: {
    fontSize: 13,
    color: "#9CA3AF"
  },
  manageSubscriptionButton: {
    alignSelf: "flex-start",
    marginBottom: 24,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  manageSubscriptionButtonText: {
    fontSize: 15,
    color: "#2563EB",
    fontWeight: "600"
  },
  yesterdayInsightCard: {
    backgroundColor: "#374151",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  yesterdayInsightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  yesterdayInsightDate: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500"
  },
  yesterdayInsightDismiss: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center"
  },
  yesterdayInsightDismissText: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "300"
  },
  yesterdayInsightAffirmation: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8
  },
  yesterdayInsightCategory: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4
  },
  yesterdayInsightValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 12
  },
  yesterdayInsightMessage: {
    color: "#D1D5DB",
    fontSize: 14,
    lineHeight: 20
  },
  mealsList: {
    gap: 12
  },
  mealCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  mealIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  mealIconText: {
    color: "#6B7280",
    fontSize: 18
  },
  mealInfo: {
    flex: 1
  },
  mealLabel: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "400"
  },
  mealCalories: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4
  },
  mealMacros: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8
  },
  addCircle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  addCircleText: {
    color: "#6B7280",
    fontSize: 20,
    fontWeight: "400",
    lineHeight: 20
  },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    zIndex: 100
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 4,
    paddingTop: 2
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabelContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabel: {
    color: "#111827",
    fontSize: 9,
    fontWeight: "500"
  },
  tabLabelActive: {
    color: "#2563EB"
  },
  tabProBadge: {
    position: "absolute",
    width: 40,
    height: 20,
    top: -26,
    right: -30
  },
  analysisContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 12
  },
  analysisMacroList: {
    flexDirection: "column",
    gap: 10
  },
  analysisMacroCard: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 26,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  analysisMacroContent: {
    flex: 1
  },
  analysisMacroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  analysisMacroName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1,
    marginRight: 8
  },
  analysisMacroChevron: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500"
  },
  analysisMacroHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 4
  },
  analysisMacroChevronWrap: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14
  },
  analysisMacroCurrent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827"
  },
  analysisMacroSlashTarget: {
    fontSize: 14,
    fontWeight: "400",
    color: "#9CA3AF"
  },
  analysisMacroRingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
  },
  analysisMacroRingWrap: {
    width: "100%"
  },
  analysisMacroProgressBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8
  },
  analysisMacroProgressFill: {
    height: "100%",
    backgroundColor: "#4263EB",
    borderRadius: 4
  },
  analysisMacroRingCenter: {
    paddingTop: 8,
    alignItems: "center"
  },
  analysisMacroRingValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827"
  },
  analysisMacroTarget: {
    fontSize: 14,
    fontWeight: "400",
    color: "#9CA3AF",
    marginTop: 8,
    alignSelf: "center"
  },
  analysisMicroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 0
  },
  analysisMicroCard: {
    width: "32%",
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  analysisMicroName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8
  },
  analysisMicroValues: {
    flexDirection: "column"
  },
  analysisMicroCurrent: {
    fontSize: 10,
    fontWeight: "600",
    color: "#111827"
  },
  analysisMicroTarget: {
    fontSize: 10,
    fontWeight: "400",
    color: "#9CA3AF",
    marginTop: 2
  },
  insightsRoot: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F5F5F7"
  },
  insightsSubTabsContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12
  },
  insightsSubTabs: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  insightsSubTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 22
  },
  insightsSubTabActive: {
    backgroundColor: "#E0E7FF"
  },
  insightsSubTabLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700"
  },
  insightsSubTabLabelActive: {
    color: "#1D4ED8"
  },
  insightsContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 120
  },
  insightsEmpty: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
    paddingTop: 16
  },
  insightsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  insightsCardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 14
  },
  insightsCardSummary: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 16
  },
  insightsTips: {
    marginTop: 8
  },
  insightsTipsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666666",
    marginBottom: 8,
    letterSpacing: 0.5
  },
  insightsTipsDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 12
  },
  insightsTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14
  },
  insightsTipBar: {
    width: 5,
    borderRadius: 3,
    minHeight: 20,
    alignSelf: "stretch",
    marginRight: 10
  },
  insightsTipTextWrap: {
    flex: 1
  },
  insightsTipItem: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 22
  },
  nutrientDetailContent: {
    paddingTop: HEADER_TO_CONTENT_GAP,
    paddingBottom: 120,
    paddingHorizontal: 12
  },
  nutrientDetailExplanation: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 16
  },
  nutrientDetailProgress: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 24
  },
  nutrientDetailContributorsLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  nutrientDetailContributorsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280"
  },
  contributorsProBadge: {
    width: 36,
    height: 18
  },
  nutrientDetailEmpty: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic"
  },
  nutrientDetailContributorsWrapper: {
    position: "relative",
    minHeight: 80
  },
  nutrientDetailContributors: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  nutrientDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  nutrientDetailRowName: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
    marginRight: 12
  },
  nutrientDetailRowAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827"
  },
  nutrientDetailRowLast: {
    borderBottomWidth: 0
  },
  addScreen: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    justifyContent: "flex-start"
  },
  addHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: HEADER_TO_CONTENT_GAP
  },
  addHeaderButton: {
    backgroundColor: "#2563EB",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  addHeaderButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15
  },
  templateHeaderButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  templateDeleteButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  templateDeleteButtonText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 15
  },
  addScroll: {
    flex: 1
  },
  addScrollContent: {
    paddingBottom: 40
  },
  addCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    minHeight: 240,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  addHint: {
    color: "#6B7280",
    fontStyle: "italic",
    marginBottom: 12
  },
  addInput: {
    minHeight: 160,
    color: "#111827",
    fontSize: 16
  },
  templateNameContainer: {
    marginBottom: 20
  },
  templateNameLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 8
  },
  templateNameInputCompact: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  addSubmit: {
    marginTop: 24,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  addSubmitDisabled: {
    opacity: 0.7
  },
  addSubmitText: {
    color: "#3F3F46",
    fontWeight: "600",
    fontSize: 16
  },
  addSubmitTextDisabled: {
    color: "rgba(255,255,255,0.8)"
  },
  addError: {
    marginTop: 12,
    color: "#EF4444",
    textAlign: "center"
  },
  addFooter: {
    marginTop: 16,
    color: "#9CA3AF",
    textAlign: "center"
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 12,
    marginHorizontal: 0,
    width: "100%",
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  itemHeaderText: {
    flex: 1,
    marginRight: 10,
    minWidth: 0
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1
  },
  itemSubtitle: {
    color: "#6B7280",
    marginTop: 4
  },
  itemChevron: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  itemChevronText: {
    color: "#6B7280",
    fontSize: 24,
    fontWeight: "300"
  },
  itemMacros: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6
  },
  macroPill: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999
  },
  macroText: {
    color: "#374151",
    fontSize: 10,
    fontWeight: "600"
  },
  itemCalories: {
    marginLeft: "auto",
    color: "#111827",
    fontSize: 11,
    fontWeight: "600"
  },
  doneButton: {
    marginHorizontal: 12,
    marginBottom: 24,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3F3F46"
  },
  emptyText: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 24
  },
  exportContent: {
    paddingTop: 8,
    paddingBottom: 100,
    paddingHorizontal: 12
  },
  exportOption: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  exportOptionSelected: {
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "#2563EB"
  },
  exportOptionText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500"
  },
  exportOptionTextSelected: {
    color: "#2563EB",
    fontWeight: "600"
  },
  customRangeContainer: {
    marginTop: 12,
    marginBottom: 12
  },
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12
  },
  dateLabel: {
    fontSize: 14,
    color: "#6B7280",
    width: 60,
    marginRight: 12
  },
  dateInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  exportInfo: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center"
  },
  exportButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  personalDetailsContent: {
    paddingTop: HEADER_TO_CONTENT_GAP,
    paddingBottom: 120,
    paddingHorizontal: 12
  },
  personalInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  helperText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    marginTop: -8
  },
  optionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24
  },
  optionButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  optionButtonSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6"
  },
  optionButtonText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500"
  },
  optionButtonTextSelected: {
    color: "#FFFFFF"
  },
  heightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24
  },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  unitButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  unitButtonSelected: {
    backgroundColor: "#3B82F6"
  },
  unitButtonText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500"
  },
  unitButtonTextSelected: {
    color: "#FFFFFF"
  },
  goalOption: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  goalOptionSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6"
  },
  goalOptionText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500"
  },
  goalOptionTextSelected: {
    color: "#FFFFFF"
  },
  activityOption: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  activityOptionSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6"
  },
  activityOptionLabel: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
    marginBottom: 4
  },
  activityOptionLabelSelected: {
    color: "#FFFFFF"
  },
  activityOptionDescription: {
    fontSize: 14,
    color: "#6B7280"
  },
  activityOptionDescriptionSelected: {
    color: "#E5E7EB"
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827"
  },
  personalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: HEADER_TO_CONTENT_GAP
  },
  personalSaveButton: {
    minWidth: 60,
    alignItems: "flex-end"
  },
  wheelPickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  wheelPickerSelection: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    zIndex: 1,
    borderRadius: 8,
    marginHorizontal: 4
  },
  wheelPickerScroll: {
    flex: 1
  },
  wheelPickerContent: {
    paddingVertical: ITEM_HEIGHT * 2
  },
  wheelPickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center"
  },
  wheelPickerItemText: {
    fontSize: 18,
    color: "#000000",
    fontWeight: "500"
  },
  collapsibleFieldContainer: {
    marginBottom: 20
  },
  collapsibleFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  collapsibleFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  collapsibleFieldValue: {
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: "flex-end"
  },
  collapsibleFieldValueText: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "400"
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  fieldValue: {
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: "flex-end"
  },
  fieldValueInput: {
    textAlign: "right"
  },
  fieldValueError: {
    borderWidth: 1,
    borderColor: "#DC2626"
  },
  fieldValueText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "400"
  },
  heightInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  heightInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 100,
    fontSize: 12,
    color: "#111827",
    textAlign: "right"
  },
  unitDropdown: {
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "90%",
    maxWidth: 400
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  modalButton: {
    fontSize: 16,
    color: "#3B82F6",
    fontWeight: "600"
  },
  inlinePickerContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 8
  },
  inlinePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 4
  },
  inlinePicker: {
    width: "100%",
    backgroundColor: "#FFFFFF"
  },
  dropdownContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: 12,
    minWidth: 200,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#111827"
  },
  datePickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  datePickerColumn: {
    flex: 1
  },
  heightPickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  heightPickerColumn: {
    flex: 2
  },
  heightUnitColumn: {
    flex: 1
  },
  singleWheelPicker: {
    marginBottom: 12
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600"
  },
  foodDetailContent: {
    paddingTop: HEADER_TO_CONTENT_GAP,
    paddingBottom: 120,
    paddingHorizontal: 12
  },
  foodDetailSectionWrapper: {
    position: "relative",
    marginBottom: 32
  },
  foodDetailSection: {
    marginBottom: 0
  },
  foodDetailHealthSection: {
    marginTop: 24,
    marginBottom: 24
  },
  foodDetailSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 16,
    letterSpacing: 0
  },
  foodDetailMacros: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24
  },
  foodDetailMacroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    minWidth: "45%",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  foodDetailMacroValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4
  },
  foodDetailMacroLabel: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600"
  },
  foodDetailMacroInput: {
    marginTop: 4,
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    fontSize: 14,
    color: "#111827"
  },
  foodDetailMicros: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginTop: 12,
    marginBottom: 16
  },
  foodDetailMicroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  foodDetailMicroLabel: {
    fontSize: 14,
    color: "#374151"
  },
  foodDetailMicroValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827"
  },
  foodDetailSaveButton: {
    marginTop: 8,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  foodDetailSaveButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600"
  },
  foodDetailSaveButtonDisabled: {
    backgroundColor: "#F3F4F6",
    shadowOpacity: 0
  },
  foodDetailSaveButtonTextDisabled: {
    color: "#9CA3AF"
  },
  foodDetailSaveMessage: {
    marginTop: 8,
    alignSelf: "center",
    fontSize: 12,
    color: "#059669"
  },
  suggestionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  suggestionChip: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  suggestionText: {
    fontSize: 12,
    color: "#4F46E5",
    fontWeight: "500"
  },
  templatesSection: {
    marginTop: 20,
    marginBottom: 12
  },
  templatesSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8
  },
  templatesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  templateChipWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  templateChip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  templateChipText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500"
  },
  templateEditButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center"
  },
  templateEditButtonText: {
    fontSize: 12,
    color: "#6B7280"
  },
  saveTemplateButton: {
    marginTop: 16,
    marginBottom: 12,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  saveTemplateText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600"
  },
  templateModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  templateModalHeader: {
    marginBottom: 20
  },
  templateModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12
  },
  templateNameInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    marginBottom: 20,
    backgroundColor: "#F9FAFB"
  },
  templateModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  templateModalDelete: {
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  templateModalDeleteText: {
    fontSize: 16,
    color: "#DC2626",
    fontWeight: "500"
  },
  templateModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  templateModalCancelText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500"
  },
  templateModalSave: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  templateModalSaveText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600"
  },
  foodDetailLoading: {
    padding: 24,
    alignItems: "center"
  },
  foodDetailLoadingText: {
    fontSize: 14,
    color: "#6B7280"
  },
  foodDetailHealthQuotient: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  foodDetailHealthQuotientValue: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10
  },
  foodDetailHealthQualities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  foodDetailHealthQualityPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  foodDetailHealthQualityPillText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF"
  },
  foodDetailHealthQuotientBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden"
  },
  foodDetailHealthQuotientFill: {
    height: "100%",
    borderRadius: 4
  },
  foodDetailInsights: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  foodDetailTip: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  foodDetailTipBullet: {
    fontSize: 20,
    color: "#2563EB",
    marginRight: 12,
    fontWeight: "700"
  },
  foodDetailTipText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    flex: 1
  }
});
