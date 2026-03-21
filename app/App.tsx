import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
  Easing,
  AppState,
  Switch,
  ActivityIndicator,
  Linking,
  Alert
} from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import Svg, { Circle, Path } from "react-native-svg";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { SubscriptionProvider, useSubscription } from "./SubscriptionContext";
import { setSecureJSON, getSecureJSON, SECURE_KEYS } from "./secureStorage";
import {
  DEFAULT_MEAL_REMINDER,
  updateMealReminderSchedule,
  requestMealReminderPermission,
  initializeNotificationHandler,
  MEAL_REMINDER_ID,
  type MealReminderSettings
} from "./mealReminderNotifications";

/** EAS project UUID — required for getExpoPushTokenAsync in bare / Xcode builds (see docs/notification-strategy.md). */
let warnedMissingEASProjectId = false;
function resolveEASProjectId(): string | undefined {
  const fromEnv =
    typeof process !== "undefined" && process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? String(process.env.EXPO_PUBLIC_EAS_PROJECT_ID).trim()
      : "";
  if (fromEnv) return fromEnv;

  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromManifest = extra?.eas?.projectId?.trim();
  if (fromManifest) return fromManifest;

  const eas = (Constants as { easConfig?: { projectId?: string } }).easConfig;
  const fromEasConfig = eas?.projectId?.trim();
  if (fromEasConfig) return fromEasConfig;

  return undefined;
}

// Tab icon rendered from local image asset with tint support.
function TabIcon({
  source,
  size = 24,
  tintColor,
}: {
  source: number;
  size?: number;
  tintColor?: string;
}) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size, ...(tintColor ? { tintColor } : {}) }}
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
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (
    cx: number,
    cy: number,
    r: number,
    startAngleDeg: number,
    endAngleDeg: number
  ) => {
    const start = polarToCartesian(cx, cy, r, startAngleDeg);
    const end = polarToCartesian(cx, cy, r, endAngleDeg);
    const sweep = endAngleDeg - startAngleDeg;
    const largeArcFlag = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  const stroke = Math.max(6, (RING_STROKE / RING_SIZE) * size);
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const startAngle = 135;
  const totalAngle = 270;
  const trackEndAngle = startAngle + totalAngle;

  const safeProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const displayValue = Math.round(Number.isFinite(value) ? value : 0);
  const displayText = `${displayValue}${suffix}`;
  const progressEndAngle = startAngle + totalAngle * safeProgress;
  const trackPath = describeArc(center, center, radius, startAngle, trackEndAngle);
  const progressPath =
    safeProgress > 0 ? describeArc(center, center, radius, startAngle, progressEndAngle) : "";

  return (
    <View style={{ width: size, height: size, position: "relative" }} pointerEvents="none">
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Path
          d={trackPath}
          stroke="#E0E0E0"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        {safeProgress > 0.001 && (
          <Path
            d={progressPath}
            stroke="#4263EB"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
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

const SWIPE_SENSITIVITY = 1.3; // Slower, smoother tracking
const DELETE_THRESHOLD = 120; // Swipe threshold in pixels to trigger delete

/** Swipeable item card: tap opens detail, swipe left to delete. */
const SwipeableItemCard: React.FC<{
  item: { id: string; name: string; quantity: number; unit: string; grams: number; nutrients: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number } };
  onOpenDetail: () => void;
  onDelete: () => void;
  cardStyle: any;
  cardContent: React.ReactNode;
}> = ({ item, onOpenDetail, onDelete, cardStyle, cardContent }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const cardWidthRef = useRef(0);
  const screenWidth = Dimensions.get("window").width;
  
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          const { dx } = g;
          const amplified = lastOffset.current + dx * SWIPE_SENSITIVITY;
          // Allow swiping up to full screen width
          const newVal = Math.max(-screenWidth, Math.min(0, amplified));
          translateX.setValue(newVal);
        },
        onPanResponderRelease: (_, g) => {
          const { dx, vx } = g;
          const current = lastOffset.current + dx * SWIPE_SENSITIVITY;
          
          // Check if user swiped far enough to auto-delete (single longer swipe)
          const shouldDelete = current < -DELETE_THRESHOLD || (dx < -DELETE_THRESHOLD && vx < -0.3);
          
          if (shouldDelete) {
            // Animate off screen and then delete
            Animated.timing(translateX, {
              toValue: -screenWidth,
              duration: 250,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              onDelete();
            });
          } else {
            // Snap back if not swiped far enough
            lastOffset.current = 0;
            Animated.timing(translateX, {
              toValue: 0,
              duration: 320,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [translateX, onDelete, screenWidth]
  );
  
  return (
    <View 
      style={{ marginBottom: 14, overflow: "hidden" }} 
      {...panResponder.panHandlers}
      onLayout={(event) => {
        cardWidthRef.current = event.nativeEvent.layout.width;
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: "#DC2626",
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          justifyContent: "center",
          alignItems: "flex-end",
          paddingRight: 16,
          zIndex: 0,
        }}
      >
        <TouchableOpacity
          onPress={onDelete}
          style={{ justifyContent: "center", alignItems: "center" }}
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

// For local testing, use: http://YOUR_MAC_IP:4000/v1 (set EXPO_PUBLIC_API_BASE_URL in .env)
// For production / App Store builds, omit EXPO_PUBLIC_API_BASE_URL or use HTTPS Render URL.
const PRODUCTION_API_BASE_URL = "https://meal-tracking-api.onrender.com/v1";

function isLikelyPrivateOrLocalHttpUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (!lower.startsWith("http://")) return false;
  return (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    /\b192\.168\.\d{1,3}\.\d{1,3}\b/.test(lower) ||
    /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(lower) ||
    /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/.test(lower)
  );
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!fromEnv) return PRODUCTION_API_BASE_URL;
  // Release archives often bake EXPO_PUBLIC_* from the machine that built the bundle.
  // If that was a LAN HTTP URL, all devices off that Wi‑Fi will fail silently.
  if (!__DEV__ && isLikelyPrivateOrLocalHttpUrl(fromEnv)) {
    return PRODUCTION_API_BASE_URL;
  }
  return fromEnv;
}

const API_BASE_URL = resolveApiBaseUrl();

/**
 * Barcode lookup hits GET /foods/barcode/:code on the backend (Open Food Facts proxy).
 * On a physical phone, dev bundles often set EXPO_PUBLIC_API_BASE_URL to a LAN IP; that
 * backend may be off or outdated. In __DEV__, route barcode to production HTTPS so scans work
 * without running the API on your Mac. Override with EXPO_PUBLIC_BARCODE_API_BASE_URL.
 */
function resolveBarcodeApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_BARCODE_API_BASE_URL?.trim();
  if (override) return override;
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (__DEV__ && raw && isLikelyPrivateOrLocalHttpUrl(raw)) {
    return PRODUCTION_API_BASE_URL;
  }
  return API_BASE_URL;
}

const BARCODE_API_BASE_URL = resolveBarcodeApiBaseUrl();

if (__DEV__) {
  // Helps confirm what URL Metro / Dev Client is using (not logged in App Store builds).
  console.log("[api] EXPO_PUBLIC_API_BASE_URL raw:", process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log("[api] resolved API_BASE_URL:", API_BASE_URL);
  console.log("[api] BARCODE_API_BASE_URL (used for /foods/barcode only):", BARCODE_API_BASE_URL);
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (raw && isLikelyPrivateOrLocalHttpUrl(raw)) {
    console.warn(
      "[api] Your bundle uses a local/LAN API base URL — meal/photo requests hit your Mac (or fail), not Render. " +
        "You will not see POST /v1/meals/* in Render logs. Unset EXPO_PUBLIC_API_BASE_URL or set it to " +
        PRODUCTION_API_BASE_URL +
        " to test the hosted API."
    );
  }
}

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
  genderAtBirth: "male" | "female" | "other" | null;
  heightCm: number | null;
  heightUnit: "cm" | "in";
  weightKg: number | null;
  goal: string | null;
  activityLevel: "low" | "medium" | "high" | null;
  customTargets?: {
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
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

/** Default grams shown in barcode quantity step (from API serving estimate). */
function formatBarcodeGramsDefault(g: number): string {
  if (!Number.isFinite(g) || g <= 0) return "100";
  const rounded = Math.round(g * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function parseBarcodeGramsInput(raw: string): number | null {
  const t = raw.replace(",", ".").trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

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
  // Fraction of calories from carbs (4 kcal/g) and fat (9 kcal/g) — not grams/calories
  const carbsCalorieFraction = ((nutrients.carbs_g || 0) * 4) / calories;
  const fatCalorieFraction = ((nutrients.fat_g || 0) * 9) / calories;

  if (proteinPerCal > 0.5 && nutrients.protein_g > 0) qualities.push("High Protein");
  if (fiberPerCal > 0.3 && nutrients.fiber_g > 0) qualities.push("High Fiber");
  if (carbsCalorieFraction < 0.4 && nutrients.carbs_g > 0) qualities.push("Low carbs");
  if (fatCalorieFraction < 0.2 && nutrients.fat_g > 0) qualities.push("Low Fat");
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
  bowl: 220, bowls: 220,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  ml: 1, mls: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  oz: 30, floz: 30,
  piece: 50, pieces: 50, serving: 100, servings: 100,
  slice: 30, slices: 30
};

/** Convert quantity + unit to grams for a given food (for default per-piece/portion). */
function quantityUnitToGrams(quantity: number, unit: string, foodName: string): number {
  const u = (unit || "g").toLowerCase().replace(/\s+/g, "");
  if (u === "g" || u === "gram" || u === "grams") return quantity;
  if (u === "ml" || u === "mls" || u === "milliliter" || u === "milliliters") return quantity;
  const perUnit = UNIT_TO_GRAMS[u];
  if (perUnit != null) return quantity * perUnit;
  return quantity * inferDefaultServingGrams(foodName);
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

function normalizeParsedUnit(raw: string): string {
  const u = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    pc: "piece",
    pcs: "piece",
    pieces: "piece",
    grams: "g",
    gram: "g",
    gms: "g",
    milliliter: "ml",
    milliliters: "ml",
    mls: "ml",
    cups: "cup",
    bowls: "bowl",
    servings: "serving",
    tablespoons: "tbsp",
    tablespoon: "tbsp",
    teaspoons: "tsp",
    teaspoon: "tsp",
    slices: "slice"
  };
  return map[u] || u;
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
    const unitWords = [
      "packet", "packets",
      "pc", "pcs", "piece", "pieces",
      "g", "gram", "grams",
      "ml", "milliliter", "milliliters",
      "cup", "cups", "bowl", "bowls", "serving", "servings",
      "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
      "slice", "slices"
    ];
    let numUnitMatch = null;
    let parsedUnit: string | undefined;
    let num = NaN;
    let foodPart = "";
    
    // Try "<num> <unit> <food>" first
    const numUnitFoodMatch = lower.match(
      /^(\d+(?:\.\d+)?)\s+([a-z]+)\s+(.+)$/
    );
    if (numUnitFoodMatch && unitWords.includes(numUnitFoodMatch[2])) {
      num = parseFloat(numUnitFoodMatch[1]);
      parsedUnit = normalizeParsedUnit(numUnitFoodMatch[2]);
      foodPart = numUnitFoodMatch[3].trim();
    } else {
      // Try "<food> <num> <unit>"
      const foodNumUnitMatch = lower.match(
        /^(.+?)\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s*$/
      );
      if (foodNumUnitMatch && unitWords.includes(foodNumUnitMatch[3])) {
        num = parseFloat(foodNumUnitMatch[2]);
        parsedUnit = normalizeParsedUnit(foodNumUnitMatch[3]);
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
        unit: parsedUnit,
        approx: !Number.isFinite(num),
        role: detectFoodRole(name),
        confidence: parsedUnit ? 0.85 : 0.8,
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
    } else if (f.unit && qty) {
      totalMainGrams += quantityUnitToGrams(qty, f.unit, f.name);
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
      if (isBreadLike(lowerName) || (quantity && quantity > 0 && unit === "piece")) {
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
      } else if (unit && quantity && quantity > 0) {
        // Preserve explicit unit from input (cup, bowl, serving, g, ml, etc.)
        grams = quantityUnitToGrams(quantity, unit, f.name);
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

  // Only exact (normalized) match: use a saved food only when it matches exactly.
  // If the user chose a recommendation from the suggestions list, the line will
  // already contain the exact saved food name, so this will match.
  const normalizedKey = normalizeFoodNameForDedup(foodPart);
  const canonical = normalizedKey ? nameToCanonical.get(normalizedKey) : null;

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
  dateOfBirth: "1990-01-01",
  genderAtBirth: "female",
  heightCm: null,
  heightUnit: "cm",
  weightKg: null,
  goal: null,
  activityLevel: "medium",
  customTargets: null
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
  if (
    profile.customTargets &&
    Number.isFinite(profile.customTargets.calories_kcal) &&
    Number.isFinite(profile.customTargets.protein_g) &&
    Number.isFinite(profile.customTargets.carbs_g) &&
    Number.isFinite(profile.customTargets.fat_g)
  ) {
    return {
      calories_kcal: Math.max(800, Math.round(profile.customTargets.calories_kcal)),
      protein_g: Math.max(20, Math.round(profile.customTargets.protein_g)),
      carbs_g: Math.max(20, Math.round(profile.customTargets.carbs_g)),
      fat_g: Math.max(10, Math.round(profile.customTargets.fat_g))
    };
  }

  // Calculate BMR using Mifflin-St Jeor Equation
  const calculateBMR = (
    weightKg: number,
    heightCm: number,
    age: number,
    gender: "male" | "female" | "other" | null
  ): number => {
    const male = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    const female = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    if (gender === "male") return male;
    if (gender === "female") return female;
    return (male + female) / 2;
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
  const activityLevel = profile.activityLevel ?? "medium";
  const multiplier = activityMultipliers[activityLevel] ?? 1.4;

  if (age && weightKg && heightCm) {
    const bmr = calculateBMR(weightKg, heightCm, age, profile.genderAtBirth);
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
const MEAL_REMINDER_STORAGE_KEY = "@mealtracking_mealReminder";
const REMINDER_DEVICE_ID_KEY = "@mealtracking_reminderDeviceId";
const REMINDER_PUSH_TOKEN_KEY = "@mealtracking_expoPushToken";
const INSIGHTS_LAST_VIEWED_KEY = "@mealtracking_insightsLastViewed";
const HAS_LOGGED_MEAL_KEY = "@mealtracking_hasLoggedMeal";
const NEW_USER_PAYWALL_DISMISSED_KEY = "@mealtracking_newUserPaywallDismissed";

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

/** Renders a tip with a heart icon above the text (green = positive, orange = improvement) and bold first phrase. */
const renderInsightTip = (tip: InsightTip, key: number, itemStyle: object) => {
  const { text, type } = tip;
  const heartIcon = type === "positive" 
    ? require("./assets/Greenheart.png")
    : require("./assets/Orangeheart.png");
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
      <Image source={heartIcon} style={styles.insightsTipHeart} resizeMode="contain" />
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

/** Response shape from GET /v1/foods/barcode/:code (Open Food Facts). */
type BarcodePreview = {
  found: boolean;
  barcode: string;
  productName: string;
  brand?: string;
  servingGrams: number;
  nutrients?: NutrientTotals;
  confidence: number;
  missingFields: string[];
  source?: string;
  notes?: string[];
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

const HEALTH_CITATION_SOURCES: { label: string; url: string }[] = [
  {
    label: "NIH Office of Dietary Supplements: Dietary Reference Intakes (DRIs)",
    url: "https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx"
  },
  {
    label: "USDA/HHS: Dietary Guidelines for Americans",
    url: "https://www.dietaryguidelines.gov/"
  },
  {
    label: "Mifflin-St Jeor equation reference (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/2305711/"
  },
  {
    label: "WHO: Salt reduction (sodium guidance)",
    url: "https://www.who.int/news-room/fact-sheets/detail/salt-reduction"
  }
];

const HEALTH_CONTENT_DISCLAIMER =
  "Nutrition targets and insights are informational only and not medical advice. Please consult a qualified healthcare professional for diagnosis or treatment decisions.";

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
type MealInsight = { text: string; type: "positive" | "improvement"; suggestions?: string[] } | null;

/**
 * Analyze a single meal and provide insights about missing nutrients, high sodium, or imbalances.
 * Returns the most important insight for the meal, or null if the meal looks balanced.
 */
/**
 * Extract cooking method and preparation details from food name
 */
function extractCookingMethod(foodName: string): {
  method: string | null;
  oil: string | null;
  isHomeCooked: boolean;
} {
  const lower = foodName.toLowerCase();
  const methods: string[] = [];
  let oil: string | null = null;
  let isHomeCooked = false;

  // Check for cooking methods
  if (/\b(air\s*fried|air\s*fry)\b/i.test(lower)) {
    methods.push("air fried");
  }
  if (/\b(baked|roasted|roast)\b/i.test(lower)) {
    methods.push("baked");
  }
  if (/\b(steamed|steam)\b/i.test(lower)) {
    methods.push("steamed");
  }
  if (/\b(grilled|grill)\b/i.test(lower)) {
    methods.push("grilled");
  }
  if (/\b(boiled|boil)\b/i.test(lower)) {
    methods.push("boiled");
  }
  if (/\b(fried|deep\s*fried|pan\s*fried)\b/i.test(lower)) {
    methods.push("fried");
  }

  // Check for home cooked indicators
  if (/\b(home\s*cooked|homemade|home\s*made|made\s*at\s*home)\b/i.test(lower)) {
    isHomeCooked = true;
  }

  // Check for cooking oils/fats
  const oilPatterns = [
    { pattern: /\b(avocado\s*oil|avocado)\b/i, name: "avocado oil" },
    { pattern: /\b(olive\s*oil|olive)\b/i, name: "olive oil" },
    { pattern: /\b(coconut\s*oil|coconut)\b/i, name: "coconut oil" },
    { pattern: /\b(ghee|clarified\s*butter)\b/i, name: "ghee" },
    { pattern: /\b(butter)\b/i, name: "butter" },
    { pattern: /\b(sunflower\s*oil)\b/i, name: "sunflower oil" },
    { pattern: /\b(canola\s*oil)\b/i, name: "canola oil" },
    { pattern: /\b(vegetable\s*oil)\b/i, name: "vegetable oil" },
  ];

  for (const { pattern, name } of oilPatterns) {
    if (pattern.test(lower)) {
      oil = name;
      break;
    }
  }

  return {
    method: methods.length > 0 ? methods[0] : null,
    oil,
    isHomeCooked
  };
}

function getMealInsight(
  mealItems: MealItem[],
  mealLabel: string,
  userProfile: UserProfile
): MealInsight {
  if (mealItems.length === 0) return null;

  // Calculate meal totals
  const mealTotals = mealItems.reduce((acc, item) => sumTotals(acc, item.nutrients), emptyTotals());
  const mealMicros: Record<MicroKey, number> = {} as Record<MicroKey, number>;
  for (const k of MICRO_KEYS) mealMicros[k] = 0;
  for (const item of mealItems) {
    const n = item.nutrients as Record<string, number>;
    for (const k of MICRO_KEYS) mealMicros[k] += n[k] ?? 0;
  }

  const targets = getMacroTargets(userProfile);
  const mealCalories = mealTotals.calories_kcal;
  const mealProtein = mealTotals.protein_g;
  const mealCarbs = mealTotals.carbs_g;
  const mealFat = mealTotals.fat_g;
  const mealSodium = mealMicros.sodium_mg ?? 0;
  const mealFiber = mealMicros.fiber_g ?? 0;

  // Calculate calorie breakdown
  const caloriesFromProtein = mealProtein * 4;
  const caloriesFromCarbs = mealCarbs * 4;
  const caloriesFromFat = mealFat * 9;
  const proteinPercent = mealCalories > 0 ? (caloriesFromProtein / mealCalories) * 100 : 0;
  const carbsPercent = mealCalories > 0 ? (caloriesFromCarbs / mealCalories) * 100 : 0;
  const fatPercent = mealCalories > 0 ? (caloriesFromFat / mealCalories) * 100 : 0;

  // Find highest calorie contributors
  const itemCalories = mealItems.map(item => {
    const itemNutrients = item.nutrients as Record<string, number>;
    return {
      name: item.name,
      calories: item.nutrients.calories_kcal,
      protein: item.nutrients.protein_g,
      fat: item.nutrients.fat_g,
      carbs: item.nutrients.carbs_g,
      sodium: itemNutrients.sodium_mg ?? 0
    };
  }).sort((a, b) => b.calories - a.calories);

  // Estimate meal target (roughly 20-25% of daily for main meals, 10-15% for snacks)
  const isSnack = mealLabel.toLowerCase().includes("snack");
  const mealTargetRatio = isSnack ? 0.12 : 0.22; // 12% for snacks, 22% for main meals
  const mealTargetCalories = targets.calories_kcal * mealTargetRatio;
  const mealTargetProtein = targets.protein_g * mealTargetRatio;
  const mealTargetFiber = isSnack ? 2 : 5; // Rough targets: 2g for snacks, 5g for main meals

  // Priority 1: High sodium (most actionable)
  if (mealSodium > 800) {
    // Find which items contribute most to sodium
    const highSodiumItems = itemCalories.filter(item => item.sodium > 300).slice(0, 2);
    let sodiumSource = "";
    if (highSodiumItems.length > 0) {
      const itemNames = highSodiumItems.map(item => capitalizeFirst(stripParenthetical(item.name))).join(", ");
      sodiumSource = ` (mainly from ${itemNames})`;
    }
    const suggestions = [
      "Choose lower-sodium options next time (fresh foods over packaged)",
      "Add more vegetables without added salt",
      "Use herbs and spices instead of salt for flavor"
    ];
    return {
      text: `This meal is high in sodium (${Math.round(mealSodium)}mg)${sodiumSource}. Consider balancing with lower-sodium foods in other meals today.`,
      type: "improvement",
      suggestions
    };
  }

  // Priority 2: Very low protein (important for satiety)
  if (mealTargetProtein > 0 && mealProtein < mealTargetProtein * 0.5) {
    const suggestions = [
      "Add eggs, yogurt, or cottage cheese",
      "Include beans, lentils, or tofu",
      "Add nuts, seeds, or nut butter",
      "Include fish, chicken, or lean meat"
    ];
    return {
      text: `This meal is low in protein (${Math.round(mealProtein)}g, only ${Math.round(proteinPercent)}% of calories). Adding a protein source can help keep you satisfied longer.`,
      type: "improvement",
      suggestions
    };
  }

  // Priority 3: Very low fiber
  if (mealFiber < mealTargetFiber * 0.5 && mealCalories > 150) {
    const suggestions = [
      "Add fruits or vegetables",
      "Include whole grains (oats, whole wheat bread)",
      "Add beans, lentils, or chickpeas",
      "Include nuts or seeds"
    ];
    return {
      text: `This meal could use more fiber (only ${Math.round(mealFiber)}g). Adding fruits, vegetables, or whole grains supports digestion and heart health.`,
      type: "improvement",
      suggestions
    };
  }

  // Priority 4: Very high calories relative to meal target (only for main meals)
  if (!isSnack && mealCalories > mealTargetCalories * 1.5 && mealTargetCalories > 0) {
    // Analyze what makes it calorie-dense
    const calorieDensityReasons: string[] = [];
    const topContributors = itemCalories.slice(0, 2).map(item => capitalizeFirst(stripParenthetical(item.name)));
    
    if (fatPercent > 45) {
      calorieDensityReasons.push(`high in fat (${Math.round(fatPercent)}% of calories, ${Math.round(mealFat)}g)`);
    }
    if (carbsPercent > 65) {
      calorieDensityReasons.push(`high in carbohydrates (${Math.round(carbsPercent)}% of calories, ${Math.round(mealCarbs)}g)`);
    }
    if (itemCalories.length > 0 && itemCalories[0].calories > mealCalories * 0.5) {
      calorieDensityReasons.push(`large portion sizes`);
    }

    let reasonText = "";
    if (calorieDensityReasons.length > 0) {
      reasonText = ` This is mainly due to ${calorieDensityReasons.join(" and ")}`;
      if (topContributors.length > 0) {
        reasonText += `, with ${topContributors.join(" and ")} being the main contributors`;
      }
      reasonText += ".";
    }

    const suggestions: string[] = [];
    if (fatPercent > 45) {
      suggestions.push("Consider reducing added fats (oils, butter, creamy sauces)");
    }
    if (carbsPercent > 65) {
      suggestions.push("Reduce refined carbs or choose whole grain options");
    }
    suggestions.push("Add more vegetables to increase volume without many calories");
    suggestions.push("Choose lighter options for other meals today");

    return {
      text: `This meal is quite calorie-dense (${Math.round(mealCalories)} calories, ${Math.round((mealCalories / mealTargetCalories) * 100)}% of your meal target).${reasonText} Consider balancing with lighter meals later today.`,
      type: "improvement",
      suggestions
    };
  }


  // Priority 5: Very high fat (even if calories are okay)
  if (fatPercent > 50 && mealCalories > 200) {
    const highFatItems = itemCalories.filter(item => {
      const itemFat = item.fat;
      const itemCal = item.calories;
      return itemCal > 0 && (itemFat * 9 / itemCal) > 0.5;
    }).slice(0, 2);
    let fatSource = "";
    if (highFatItems.length > 0) {
      const itemNames = highFatItems.map(item => capitalizeFirst(stripParenthetical(item.name))).join(", ");
      fatSource = ` (mainly from ${itemNames})`;
    }
    return {
      text: `This meal is very high in fat (${Math.round(fatPercent)}% of calories, ${Math.round(mealFat)}g)${fatSource}. Consider balancing with leaner options or adding more vegetables.`,
      type: "improvement",
      suggestions: [
        "Choose lean protein sources (fish, chicken, beans) over high-fat options",
        "Reduce added oils, butter, or creamy sauces",
        "Add more vegetables and whole grains for balance"
      ]
    };
  }

  // Check for healthy cooking methods and provide positive feedback
  const cookingMethodInsights: string[] = [];
  const healthyOils: string[] = [];
  const unhealthyOils: string[] = [];
  let hasHomeCooked = false;
  let hasAirFried = false;
  let hasBakedOrSteamed = false;

  for (const item of mealItems) {
    const cooking = extractCookingMethod(item.name);
    
    if (cooking.isHomeCooked) {
      hasHomeCooked = true;
    }
    if (cooking.method === "air fried") {
      hasAirFried = true;
    }
    if (cooking.method === "baked" || cooking.method === "steamed" || cooking.method === "grilled") {
      hasBakedOrSteamed = true;
    }
    if (cooking.oil) {
      const healthyOilList = ["avocado oil", "olive oil", "coconut oil"];
      if (healthyOilList.includes(cooking.oil)) {
        healthyOils.push(cooking.oil);
      } else if (cooking.oil === "ghee" || cooking.oil === "butter") {
        unhealthyOils.push(cooking.oil);
      }
    }
  }

  // Add positive feedback for healthy cooking choices
  if (hasHomeCooked && mealSodium < 600) {
    cookingMethodInsights.push("Great choice cooking at home—home-cooked meals typically have lower sodium and give you more control over ingredients.");
  }
  if (hasAirFried) {
    cookingMethodInsights.push("Air frying is a smart choice—it gives you that crispy texture with much less oil than traditional frying!");
  }
  if (hasBakedOrSteamed && fatPercent < 40) {
    cookingMethodInsights.push("Baking, steaming, or grilling helps keep meals lower in fat while preserving flavor—excellent cooking method!");
  }
  if (healthyOils.length > 0) {
    const uniqueHealthyOils = [...new Set(healthyOils)];
    const oilText = uniqueHealthyOils.length === 1 
      ? uniqueHealthyOils[0] 
      : uniqueHealthyOils.join(" and ");
    cookingMethodInsights.push(`Using ${oilText} is a heart-healthy choice—these oils are rich in monounsaturated fats that support cardiovascular health.`);
  }
  if (unhealthyOils.length > 0 && healthyOils.length === 0) {
    // Only suggest if no healthy oils were found
    const unhealthyOilText = unhealthyOils[0];
    if (unhealthyOilText === "ghee") {
      cookingMethodInsights.push("Consider trying avocado or olive oil instead of ghee for a healthier fat option with similar flavor.");
    }
  }

  // Priority 6: Good balance (positive feedback) - include cooking method insights
  if (mealProtein >= mealTargetProtein * 0.7 && mealFiber >= mealTargetFiber * 0.7 && mealSodium < 600) {
    let text = `This meal looks well-balanced with good protein (${Math.round(mealProtein)}g) and fiber (${Math.round(mealFiber)}g)—great choices!`;
    if (cookingMethodInsights.length > 0) {
      text += ` ${cookingMethodInsights[0]}`;
    }
    return {
      text,
      type: "positive"
    };
  }

  // If meal has issues but has healthy cooking methods, add positive note
  if (cookingMethodInsights.length > 0) {
    // Return a positive insight even if there are other issues, prioritizing healthy cooking
    return {
      text: cookingMethodInsights[0],
      type: "positive"
    };
  }

  // Fallback: always provide a light, encouraging insight for logged meals.
  return {
    text: "Nice work logging this meal. It looks reasonably balanced overall. Keep including protein, fiber, and colorful whole foods across the day.",
    type: "positive"
  };
}

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

  // Sodium tips - check for home-cooked meals
  const hasHomeCookedMeals = Object.values(mealItems).some(items => 
    items.some(item => extractCookingMethod(item.name).isHomeCooked)
  );
  
  if (sodium > 2300) {
    if (hasHomeCookedMeals) {
      tips.push({ text: "Sodium was high today, but great job cooking at home—home-cooked meals typically have less sodium than restaurant or packaged foods.", type: "improvement" });
    } else {
      tips.push({ text: "Sodium leaned high today; using fewer packaged foods and more home-cooked meals can bring this down.", type: "improvement" });
    }
  } else if (hasHomeCookedMeals && sodium < 1500) {
    tips.push({ text: "Excellent—your home-cooked meals are keeping sodium in a healthy range. This supports heart health and blood pressure management.", type: "positive" });
  }

  // Omega-3 tips
  if (omega3Mg > 0) {
    tips.push({ text: "Good job adding some omega-3–rich foods or supplements today; they support heart and brain health.", type: "positive" });
  }

  // Goal-specific tips - check for healthy cooking oils
  const allMealItems = Object.values(mealItems).flat();
  const healthyOilsUsed: string[] = [];
  const unhealthyOilsUsed: string[] = [];
  
  for (const item of allMealItems) {
    const cooking = extractCookingMethod(item.name);
    if (cooking.oil) {
      const healthyOilList = ["avocado oil", "olive oil", "coconut oil"];
      if (healthyOilList.includes(cooking.oil) && !healthyOilsUsed.includes(cooking.oil)) {
        healthyOilsUsed.push(cooking.oil);
      } else if ((cooking.oil === "ghee" || cooking.oil === "butter") && !unhealthyOilsUsed.includes(cooking.oil)) {
        unhealthyOilsUsed.push(cooking.oil);
      }
    }
  }

  const goal = userProfile.goal ?? "";
  if ((goal.includes("cholesterol") || goal.includes("heart")) && totals.fat_g > 0) {
    if (healthyOilsUsed.length > 0) {
      const oilText = healthyOilsUsed.length === 1 ? healthyOilsUsed[0] : healthyOilsUsed.join(" and ");
      tips.push({ text: `Great choice using ${oilText}—these heart-healthy oils are rich in monounsaturated fats that support cardiovascular health.`, type: "positive" });
    } else if (totals.fat_g > (targets.fat_g ?? 0) * 1.2) {
      tips.push({ text: "For heart and cholesterol health, keep favoring unsaturated fats (nuts, seeds, fish, olive oil, avocado oil) over deep-fried or very creamy foods.", type: "improvement" });
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

type MealTrendInsight = { text: string; type: "positive" | "improvement" } | null;

/**
 * Analyze meal-by-meal trends over the past week.
 * Returns insights about which meals are heavier, less balanced, or need improvement.
 */
function getMealTrendInsights(
  dataByDate: Record<string, DayData>,
  todayKey: string,
  userProfile: UserProfile
): MealTrendInsight[] {
  const insights: MealTrendInsight[] = [];
  const targets = getMacroTargets(userProfile);
  const mealTargetRatio = 0.22; // 22% for main meals
  const mealTargetCalories = targets.calories_kcal * mealTargetRatio;
  const mealTargetProtein = targets.protein_g * mealTargetRatio;

  // Aggregate data by meal type
  const mealStats: Record<string, { calories: number[]; protein: number[]; fiber: number[]; sodium: number[]; count: number }> = {
    "Breakfast": { calories: [], protein: [], fiber: [], sodium: [], count: 0 },
    "Lunch": { calories: [], protein: [], fiber: [], sodium: [], count: 0 },
    "Dinner": { calories: [], protein: [], fiber: [], sodium: [], count: 0 },
    "Afternoon Snack": { calories: [], protein: [], fiber: [], sodium: [], count: 0 },
    "Evening Snack": { calories: [], protein: [], fiber: [], sodium: [], count: 0 }
  };

  // Collect data from past 7 days
  for (let i = 1; i <= 7; i++) {
    const dk = addDays(todayKey, -i);
    const day = dataByDate[dk];
    if (!day || !dayHasMeals(day)) continue;

    for (const meal of day.meals) {
      const items = day.mealItems[meal.id] ?? [];
      if (items.length === 0 && meal.nutrients.calories_kcal === 0) continue;

      const mealTotals = meal.nutrients;
      const mealMicros = getMicroTotalsFromItems({ [meal.id]: items });
      const mealLabel = meal.label;

      if (mealStats[mealLabel]) {
        mealStats[mealLabel].calories.push(mealTotals.calories_kcal);
        mealStats[mealLabel].protein.push(mealTotals.protein_g);
        mealStats[mealLabel].fiber.push(mealMicros.fiber_g ?? 0);
        mealStats[mealLabel].sodium.push(mealMicros.sodium_mg ?? 0);
        mealStats[mealLabel].count += 1;
      }
    }
  }

  // Analyze trends for each meal type
  for (const [mealLabel, stats] of Object.entries(mealStats)) {
    if (stats.count < 3) continue; // Need at least 3 instances to show a trend

    const avgCalories = stats.calories.reduce((a, b) => a + b, 0) / stats.count;
    const avgProtein = stats.protein.reduce((a, b) => a + b, 0) / stats.count;
    const avgFiber = stats.fiber.reduce((a, b) => a + b, 0) / stats.count;
    const avgSodium = stats.sodium.reduce((a, b) => a + b, 0) / stats.count;
    const isSnack = mealLabel.toLowerCase().includes("snack");
    const targetCal = isSnack ? mealTargetCalories * 0.5 : mealTargetCalories;
    const targetProt = isSnack ? mealTargetProtein * 0.5 : mealTargetProtein;

    // Check if meal is consistently heavy
    if (!isSnack && avgCalories > targetCal * 1.3) {
      insights.push({
        text: `On average, your ${mealLabel.toLowerCase()}s are heavier (${Math.round(avgCalories)} calories). Consider lighter options or adding more vegetables for volume.`,
        type: "improvement"
      });
    }

    // Check if meal consistently lacks protein
    if (avgProtein < targetProt * 0.6 && targetProt > 0) {
      insights.push({
        text: `Try adding protein to your ${mealLabel.toLowerCase()}s—they average only ${Math.round(avgProtein)}g. Adding eggs, yogurt, beans, or lean meat can help with satiety.`,
        type: "improvement"
      });
    }

    // Check if meal consistently lacks fiber
    if (!isSnack && avgFiber < 3 && avgCalories > 200) {
      insights.push({
        text: `Your ${mealLabel.toLowerCase()}s could use more fiber (averaging ${Math.round(avgFiber)}g). Add fruits, vegetables, or whole grains for better balance.`,
        type: "improvement"
      });
    }

    // Check if meal is consistently high in sodium
    if (avgSodium > 800) {
      insights.push({
        text: `Your ${mealLabel.toLowerCase()}s tend to be high in sodium (averaging ${Math.round(avgSodium)}mg). Try fresh foods over packaged options.`,
        type: "improvement"
      });
    }
  }

  // Compare meal sizes to find the heaviest
  const mainMeals = ["Breakfast", "Lunch", "Dinner"].map(label => ({
    label,
    avgCal: mealStats[label]?.count >= 3
      ? mealStats[label].calories.reduce((a, b) => a + b, 0) / mealStats[label].count
      : 0
  })).filter(m => m.avgCal > 0).sort((a, b) => b.avgCal - a.avgCal);

  if (mainMeals.length >= 2) {
    const heaviest = mainMeals[0];
    const lightest = mainMeals[mainMeals.length - 1];
    if (heaviest.avgCal > lightest.avgCal * 1.4) {
      insights.push({
        text: `On average, your ${heaviest.label.toLowerCase()}s are heavier than your ${lightest.label.toLowerCase()}s. Consider redistributing calories for more balanced energy throughout the day.`,
        type: "improvement"
      });
    }
  }

  // Positive feedback for balanced meals
  const balancedMeals = Object.entries(mealStats).filter(([label, stats]) => {
    if (stats.count < 3) return false;
    const avgCal = stats.calories.reduce((a, b) => a + b, 0) / stats.count;
    const avgProt = stats.protein.reduce((a, b) => a + b, 0) / stats.count;
    const avgFib = stats.fiber.reduce((a, b) => a + b, 0) / stats.count;
    const isSnack = label.toLowerCase().includes("snack");
    const targetCal = isSnack ? mealTargetCalories * 0.5 : mealTargetCalories;
    const targetProt = isSnack ? mealTargetProtein * 0.5 : mealTargetProtein;
    return avgCal > 0 && avgProt >= targetProt * 0.7 && avgFib >= (isSnack ? 1.5 : 3);
  });

  if (balancedMeals.length >= 2) {
    insights.push({
      text: `Great job keeping your ${balancedMeals.map(([label]) => label.toLowerCase()).join(" and ")} balanced with good protein and fiber!`,
      type: "positive"
    });
  }

  return insights.slice(0, 4); // Limit to 4 most important insights
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

  // Add meal trend insights if user has logged for at least a week
  if (daysWithMeals >= 7) {
    const trendInsights = getMealTrendInsights(dataByDate, todayKey, userProfile);
    // Add trend insights at the beginning (after the first positive tip)
    if (trendInsights.length > 0) {
      tips.splice(1, 0, ...trendInsights);
    }
  }

  // De-duplicate by text and limit
  const seen = new Set<string>();
  const uniqueTips = tips.filter((t) => {
    if (seen.has(t.text)) return false;
    seen.add(t.text);
    return true;
  }).slice(0, 8); // Increased limit to accommodate trend insights

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
  const { isPro, isLoading: subscriptionLoading, presentPaywall, presentCustomerCenter } = useSubscription();
  const [view, setView] = useState<"home" | "add" | "meal" | "export" | "personal" | "savedFoods" | "terms" | "privacy" | "onboarding" | "sources">("home");
  const [showTermsPrivacySubmenu, setShowTermsPrivacySubmenu] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("meals");
  const [selectedNutrient, setSelectedNutrient] = useState<SelectedNutrient | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [selectedFoodItem, setSelectedFoodItem] = useState<MealItem | null>(null);
  const [editableFoodNutrients, setEditableFoodNutrients] = useState<NutrientTotals | null>(null);
  const [originalFoodNutrients, setOriginalFoodNutrients] = useState<NutrientTotals | null>(null);
  const [editableQuantity, setEditableQuantity] = useState<number>(1);
  const [editableUnit, setEditableUnit] = useState<string>("g");
  const [showFoodUnitDropdown, setShowFoodUnitDropdown] = useState(false);
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
  const [mealPhotoUri, setMealPhotoUri] = useState<string | null>(null);
  const [mealPhotoAnalyzing, setMealPhotoAnalyzing] = useState(false);
  const [mealPhotoProgress, setMealPhotoProgress] = useState(0);
  const [mealPhotoStatusText, setMealPhotoStatusText] = useState("Analyzing photo...");
  const [addComposerTab, setAddComposerTab] = useState<"text" | "photo" | "barcode">("text");
  const [addKeyboardOffset, setAddKeyboardOffset] = useState(0);
  const [hasAutoOpenedCamera, setHasAutoOpenedCamera] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<BarcodePreview | null>(null);
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);
  /** Grams user ate; default filled from API serving estimate after scan. */
  const [barcodeGramsInput, setBarcodeGramsInput] = useState("");
  const barcodeScanLastTsRef = useRef(0);
  const barcodeScanLastCodeRef = useRef<string>("");
  const [dataByDate, setDataByDate] = useState<Record<string, DayData>>({});
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [insightsSubTab, setInsightsSubTab] = useState<"day" | "week">("day");
  const [insightsLastViewed, setInsightsLastViewed] = useState<string>("");
  const [hasNewDayInsights, setHasNewDayInsights] = useState(false);
  const [hasNewWeekInsights, setHasNewWeekInsights] = useState(false);
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
  const [dobValue, setDobValue] = useState<string>("01/01/1990");
  const [dobDay, setDobDay] = useState<string>("14");
  const [dobMonth, setDobMonth] = useState<string>("Jul");
  const [dobYear, setDobYear] = useState<string>("1981");
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showHeightUnitDropdown, setShowHeightUnitDropdown] = useState(false);
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [showActivityDropdown, setShowActivityDropdown] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [customCaloriesInput, setCustomCaloriesInput] = useState("");
  const [customProteinInput, setCustomProteinInput] = useState("");
  const [customCarbsInput, setCustomCarbsInput] = useState("");
  const [customFatInput, setCustomFatInput] = useState("");
  const [customTargetError, setCustomTargetError] = useState<string | null>(null);
  const [showOnboardingDobPicker, setShowOnboardingDobPicker] = useState(false);
  const [showOnboardingGenderDropdown, setShowOnboardingGenderDropdown] = useState(false);
  const [showOnboardingHeightUnitDropdown, setShowOnboardingHeightUnitDropdown] = useState(false);
  const [showOnboardingWeightUnitDropdown, setShowOnboardingWeightUnitDropdown] = useState(false);
  const [showOnboardingActivityDropdown, setShowOnboardingActivityDropdown] = useState(false);
  const [onboardingDobDraft, setOnboardingDobDraft] = useState<Date>(new Date(1990, 0, 1));
  const [yesterdayInsightDismissed, setYesterdayInsightDismissed] = useState<string>("");
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [newUserPaywallVisible, setNewUserPaywallVisible] = useState(false);
  const [editingSavedFoodName, setEditingSavedFoodName] = useState<string | null>(null);
  const [savedFoodEditName, setSavedFoodEditName] = useState("");
  const [savedFoodEditCalories, setSavedFoodEditCalories] = useState("");
  const [savedFoodEditServingGrams, setSavedFoodEditServingGrams] = useState("");
  const [savedFoodDeleteConfirm, setSavedFoodDeleteConfirm] = useState<string | null>(null);
  const [savedFoodsSearchQuery, setSavedFoodsSearchQuery] = useState("");
  const [mealReminderSettings, setMealReminderSettings] = useState<MealReminderSettings>(DEFAULT_MEAL_REMINDER);
  const reminderDeviceIdRef = useRef<string | null>(null);
  const reminderPushTokenRef = useRef<string | null>(null);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const sourcesReturnViewRef = useRef<
    "home" | "add" | "meal" | "export" | "personal" | "savedFoods" | "terms" | "privacy" | "onboarding"
  >("home");

  const addScrollRef = useRef<ScrollView>(null);
  const addInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraView>(null);
  const hasShownLaunchPaywallRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const maybeShowNoFoodFoundAlert = useCallback((message: string) => {
    const lower = message.toLowerCase();
    if (
      lower.includes("could not identify foods") ||
      lower.includes("no food") ||
      lower.includes("no foods")
    ) {
      Alert.alert("No food found", "No food was found in this image. Please try another photo.");
    }
  }, []);

  // Track when user logs their first meal (only run once after hydration)
  // TEMPORARILY DISABLED - will re-enable after app loads
  // const hasCheckedMealLoggedRef = useRef(false);
  // useEffect(() => {
  //   if (!hydrated || hasCheckedMealLoggedRef.current) return;
  //   hasCheckedMealLoggedRef.current = true;
  //   
  //   // Delay to ensure dataByDate is loaded
  //   setTimeout(async () => {
  //     try {
  //       const hasLoggedMeal = await AsyncStorage.getItem(HAS_LOGGED_MEAL_KEY);
  //       if (hasLoggedMeal === "true") return; // Already marked
  //       
  //       // Check if user has any meals in data
  //       const hasMealsInData = Object.values(dataByDate).some(day => dayHasMeals(day));
  //       if (hasMealsInData) {
  //         await AsyncStorage.setItem(HAS_LOGGED_MEAL_KEY, "true");
  //       }
  //     } catch (err) {
  //       console.warn("Error checking meal logged:", err);
  //     }
  //   }, 2000); // Wait 2 seconds after hydration for data to load
  // }, [hydrated]);

  // Check on app launch if we should show paywall (only run once after hydration)
  // TEMPORARILY DISABLED - will re-enable after app loads
  // const hasCheckedPaywallRef = useRef(false);
  // useEffect(() => {
  //   if (!hydrated || isPro || hasCheckedPaywallRef.current) return;
  //   hasCheckedPaywallRef.current = true;
  //   
  //   // Delay to ensure dataByDate is loaded
  //   setTimeout(async () => {
  //     try {
  //       const hasLoggedMeal = await AsyncStorage.getItem(HAS_LOGGED_MEAL_KEY);
  //       const paywallDismissed = await AsyncStorage.getItem(NEW_USER_PAYWALL_DISMISSED_KEY);
  //       
  //       // Check if user has any meals in loaded data
  //       const hasMealsInData = Object.values(dataByDate).some(day => dayHasMeals(day));
  //       
  //       // Show paywall if user has logged meal but hasn't dismissed paywall
  //       if (hasMealsInData && hasLoggedMeal === "true" && !paywallDismissed) {
  //         // Show paywall after a short delay to ensure app is fully loaded
  //         setTimeout(() => {
  //           setNewUserPaywallVisible(true);
  //         }, 500);
  //       }
  //     } catch (err) {
  //       console.warn("Error checking new user paywall:", err);
  //     }
  //   }, 2000); // Wait 2 seconds after hydration for data to load
  // }, [hydrated, isPro]);

  useEffect(() => {
    if (!hydrated || subscriptionLoading) return;
    if (isPro) return;
    // Launch paywall should only auto-show from home, not when navigating
    // onboarding/compliance screens like Sources & methodology.
    if (view !== "home") return;
    if (hasShownLaunchPaywallRef.current) return;
    hasShownLaunchPaywallRef.current = true;
    const timer = setTimeout(() => {
      presentPaywall().catch((err) => {
        console.warn("Failed to present launch paywall:", err);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [hydrated, isPro, presentPaywall, subscriptionLoading, view]);

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

  useEffect(() => {
    if (view !== "add" || isTemplateMode || addComposerTab !== "text") return;
    const timer = setTimeout(() => addInputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [view, isTemplateMode, addComposerTab]);

  useEffect(() => {
    if (view !== "add" || isTemplateMode || addComposerTab !== "text") {
      setAddKeyboardOffset(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const h = event?.endCoordinates?.height ?? 0;
      setAddKeyboardOffset(Math.max(0, h));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setAddKeyboardOffset(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [view, isTemplateMode, addComposerTab]);

  useEffect(() => {
    if (addComposerTab !== "barcode") {
      setBarcodePreview(null);
      setBarcodeLookupLoading(false);
      setBarcodeGramsInput("");
    }
  }, [addComposerTab]);

  useEffect(() => {
    if (view !== "add" || addComposerTab !== "barcode") return;
    if (!cameraPermission?.granted) {
      requestCameraPermission().catch(() => {
        setError("Camera permission is required to scan barcodes.");
      });
    }
  }, [view, addComposerTab, cameraPermission?.granted, requestCameraPermission]);

  useEffect(() => {
    if (view !== "personal") return;
    const targets = getMacroTargets(userProfile);
    setCustomCaloriesInput(String(Math.round(targets.calories_kcal)));
    setCustomProteinInput(String(Math.round(targets.protein_g)));
    setCustomCarbsInput(String(Math.round(targets.carbs_g)));
    setCustomFatInput(String(Math.round(targets.fat_g)));
    setCustomTargetError(null);
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
      // Store user profile securely (contains sensitive info like DOB, gender, health data)
      await setSecureJSON(SECURE_KEYS.USER_PROFILE, profile);
      // Also keep in AsyncStorage as fallback for migration
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn("Failed to persist profile securely, using fallback:", err);
      // Fallback to AsyncStorage if secure storage fails
      try {
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } catch (_) {}
    }
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

  const persistMealReminder = useCallback(
    async (settings: MealReminderSettings) => {
      try {
        await AsyncStorage.setItem(MEAL_REMINDER_STORAGE_KEY, JSON.stringify(settings));
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

  // Initialize notification handler on app start (non-blocking)
  useEffect(() => {
    // Only initialize after app is hydrated and ready
    if (!hydrated) return;
    
    // Delay initialization to ensure native modules are fully loaded
    const timer = setTimeout(() => {
      try {
        // Additional check to ensure we're not in a background/terminating state
        if (AppState.currentState === "active" || AppState.currentState === "inactive") {
          initializeNotificationHandler();
        }
      } catch (err) {
        console.warn("Failed to initialize notification handler:", err);
      }
    }, 500); // Increased delay to ensure native modules are ready
    return () => clearTimeout(timer);
  }, [hydrated]);

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
        // Try secure storage first, then fallback to AsyncStorage
        let profileParsed = await getSecureJSON<UserProfile>(SECURE_KEYS.USER_PROFILE);
        if (!profileParsed) {
          // Fallback to AsyncStorage for migration
          const profileRaw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
          if (profileRaw) {
            profileParsed = JSON.parse(profileRaw);
            // Migrate to secure storage
            if (profileParsed) {
              try {
                await setSecureJSON(SECURE_KEYS.USER_PROFILE, profileParsed);
              } catch (_) {}
            }
          }
        }
        if (!cancelled) {
          if (profileParsed) {
            setUserProfile(profileParsed);
            if (profileParsed && profileParsed.dateOfBirth) {
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
            // First-time user: no profile saved yet -> onboarding
            setOnboardingStep(0);
            setView("onboarding");
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

      // Load insights last viewed date
      try {
        const lastViewedRaw = await AsyncStorage.getItem(INSIGHTS_LAST_VIEWED_KEY);
        if (!cancelled && lastViewedRaw) {
          setInsightsLastViewed(lastViewedRaw);
        }
      } catch (err) {
        console.warn("Error loading insights last viewed date:", err);
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

      // Load meal reminder settings
      try {
        const reminderRaw = await AsyncStorage.getItem(MEAL_REMINDER_STORAGE_KEY);
        if (!cancelled && reminderRaw) {
          const parsed = JSON.parse(reminderRaw) as MealReminderSettings;
          if (parsed && typeof parsed.enabled === "boolean") {
            setMealReminderSettings({
              enabled: parsed.enabled,
              hour: typeof parsed.hour === "number" ? Math.max(0, Math.min(23, parsed.hour)) : 12,
              minute: typeof parsed.minute === "number" ? Math.max(0, Math.min(59, parsed.minute)) : 0
            });
          }
        }
      } catch (err) {
        console.warn("Error loading meal reminder settings:", err);
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
  }, []); // Only run once on mount - empty dependency array

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

  // Meal reminder: schedule or cancel based on settings and whether user logged a meal today
  const dataByDateRef = useRef(dataByDate);
  const mealReminderSettingsRef = useRef(mealReminderSettings);
  dataByDateRef.current = dataByDate;
  mealReminderSettingsRef.current = mealReminderSettings;

  const getOrCreateReminderDeviceId = useCallback(async (): Promise<string> => {
    if (reminderDeviceIdRef.current) return reminderDeviceIdRef.current;
    const existing = await AsyncStorage.getItem(REMINDER_DEVICE_ID_KEY);
    if (existing) {
      reminderDeviceIdRef.current = existing;
      return existing;
    }
    const created = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    reminderDeviceIdRef.current = created;
    await AsyncStorage.setItem(REMINDER_DEVICE_ID_KEY, created);
    return created;
  }, []);

  const getExpoPushTokenForReminderSync = useCallback(
    async (enabled: boolean): Promise<string | null> => {
      if (reminderPushTokenRef.current) return reminderPushTokenRef.current;

      const stored = await AsyncStorage.getItem(REMINDER_PUSH_TOKEN_KEY);
      if (stored) {
        reminderPushTokenRef.current = stored;
        return stored;
      }

      // If reminders are disabled and there is no stored token, don't force permission prompt.
      if (!enabled) return null;

      const granted = await requestMealReminderPermission();
      if (!granted) return null;

      const projectId = resolveEASProjectId();
      if (!projectId) {
        if (!warnedMissingEASProjectId) {
          warnedMissingEASProjectId = true;
          console.warn(
            "Expo push token skipped: no EAS projectId. Set EXPO_PUBLIC_EAS_PROJECT_ID or expo.extra.eas.projectId in app.json (UUID from https://expo.dev → your project). See docs/notification-strategy.md."
          );
        }
        return null;
      }

      try {
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenResponse?.data?.trim();
        if (!token) return null;
        reminderPushTokenRef.current = token;
        await AsyncStorage.setItem(REMINDER_PUSH_TOKEN_KEY, token);
        return token;
      } catch (err) {
        console.warn("Failed to fetch Expo push token:", err);
        return null;
      }
    },
    []
  );

  const syncMealReminderStateToBackend = useCallback(
    async (settings: MealReminderSettings, hasLoggedMealToday: boolean): Promise<void> => {
      const token = await getExpoPushTokenForReminderSync(settings.enabled);
      if (!token) return;

      const deviceId = await getOrCreateReminderDeviceId();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const statusDayKey = toDateKey(new Date());

      try {
        await fetch(`${API_BASE_URL}/notifications/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            expoPushToken: token,
            timezone,
            reminderEnabled: settings.enabled,
            reminderHour: settings.hour,
            reminderMinute: settings.minute,
            hasLoggedMealToday,
            statusDayKey
          })
        });
      } catch (err) {
        console.warn("Failed to sync reminder state to backend:", err);
      }
    },
    [getExpoPushTokenForReminderSync, getOrCreateReminderDeviceId]
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      const todayKey = toDateKey(new Date());
      const dayData = dataByDateRef.current[todayKey] ?? getDefaultDayData();
      const hasMealsToday = dayHasMeals(dayData);
      updateMealReminderSchedule(mealReminderSettingsRef.current, hasMealsToday).catch((err) => {
        console.warn("Failed to update meal reminder schedule:", err);
      });
      syncMealReminderStateToBackend(mealReminderSettingsRef.current, hasMealsToday).catch((err) => {
        console.warn("Failed to sync reminder state:", err);
      });
    } catch (err) {
      console.warn("Error in meal reminder effect:", err);
    }
  }, [hydrated, mealReminderSettings, dataByDate, syncMealReminderStateToBackend]);

  useEffect(() => {
    if (!hydrated) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      try {
        const todayKey = toDateKey(new Date());
        const dayData = dataByDateRef.current[todayKey] ?? getDefaultDayData();
        const hasMealsToday = dayHasMeals(dayData);
        updateMealReminderSchedule(mealReminderSettingsRef.current, hasMealsToday).catch((err) => {
          console.warn("Failed to update meal reminder schedule on app resume:", err);
        });
        syncMealReminderStateToBackend(mealReminderSettingsRef.current, hasMealsToday).catch((err) => {
          console.warn("Failed to sync reminder state on app resume:", err);
        });
      } catch (err) {
        console.warn("Error updating meal reminder on app resume:", err);
      }
    });
    return () => sub.remove();
  }, [hydrated, syncMealReminderStateToBackend]);

  // Handle notification taps - navigate to home when user taps notification
  useEffect(() => {
    if (!hydrated) return;

    // Check if app was launched from a notification
    const isMealReminderResponse = (response: Notifications.NotificationResponse | null): boolean => {
      if (!response) return false;
      const identifier = response.notification.request.identifier || "";
      if (identifier.startsWith(MEAL_REMINDER_ID)) return true;
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      return data?.type === "meal_reminder";
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (isMealReminderResponse(response)) {
          setView("home");
        }
      })
      .catch(() => {});

    // Listen for notification taps while app is running
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isMealReminderResponse(response)) {
        setView("home");
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hydrated]);

  // Check for new insights
  useEffect(() => {
    if (!hydrated || Object.keys(dataByDate).length === 0) return;

    const past = getPastDatesWithMeals(dataByDate, todayKey);
    const latestDayWithMeals = past.length > 0 ? past[0] : null;
    
    // Check for new day insights - if there's a day with meals newer than last viewed
    if (latestDayWithMeals) {
      if (!insightsLastViewed || latestDayWithMeals > insightsLastViewed) {
        setHasNewDayInsights(true);
      } else {
        setHasNewDayInsights(false);
      }
    } else {
      setHasNewDayInsights(false);
    }

    // Check for new week insights (if there are 7+ days of data)
    const { daysWithMeals } = aggregateWeekData(dataByDate, todayKey);
    if (daysWithMeals >= 7) {
      // Check if there's any new data in the past 7 days since last view
      const sevenDaysAgo = addDays(todayKey, -6); // Past 7 days including today
      let hasNewWeekData = false;
      
      if (!insightsLastViewed) {
        // Never viewed before, so any data in past 7 days is new
        hasNewWeekData = true;
      } else {
        // Check if any day in past 7 days is newer than last viewed
        for (let i = 0; i <= 6; i++) {
          const dateKey = addDays(todayKey, -i);
          if (dateKey > insightsLastViewed) {
            const day = dataByDate[dateKey];
            if (day && dayHasMeals(day)) {
              hasNewWeekData = true;
              break;
            }
          }
        }
      }
      
      setHasNewWeekInsights(hasNewWeekData);
    } else {
      setHasNewWeekInsights(false);
    }
  }, [hydrated, dataByDate, todayKey, insightsLastViewed]);

  // Mark insights as viewed when user opens Insights tab or switches sub-tabs
  useEffect(() => {
    if (activeTab === "insights" && hydrated) {
      const markAsViewed = async () => {
        try {
          await AsyncStorage.setItem(INSIGHTS_LAST_VIEWED_KEY, todayKey);
          setInsightsLastViewed(todayKey);
          // Clear indicators when viewing the tab
          setHasNewDayInsights(false);
          setHasNewWeekInsights(false);
        } catch (err) {
          console.warn("Failed to save insights viewed date:", err);
        }
      };
      markAsViewed();
    }
  }, [activeTab, insightsSubTab, hydrated, todayKey]);

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

  const openHealthCitation = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unable to open link", "Please copy and open this URL in your browser.", [
          { text: "OK" }
        ]);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.warn("Failed to open citation link:", err);
      Alert.alert("Unable to open link", "Please try again.");
    }
  }, []);

  const openSourcesScreen = useCallback(() => {
    if (view !== "sources") {
      sourcesReturnViewRef.current = view;
    }
    setView("sources");
  }, [view]);

  // Analysis tab uses the same date as MEALS page
  const analysisDayData = getDayData(selectedDate);
  const analysisMeals = analysisDayData?.meals ?? [];
  const analysisMealItems = analysisDayData?.mealItems ?? {};
  const analysisTotals = analysisMeals.reduce((acc, meal) => sumTotals(acc, meal?.nutrients ?? emptyTotals()), emptyTotals());
  const analysisMicroTotals = getMicroTotalsFromItems(analysisMealItems);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;
  const SIDEBAR_WIDTH = screenWidth;
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

  const analyzeMealPhoto = useCallback(
    async (imageBase64: string, mimeType?: string) => {
      let progressTimer: ReturnType<typeof setInterval> | null = null;
      try {
        setMealPhotoAnalyzing(true);
        setMealPhotoProgress(6);
        setMealPhotoStatusText("Analyzing photo...");
        setError(null);

        progressTimer = setInterval(() => {
          setMealPhotoProgress((prev) => {
            if (prev >= 92) return prev;
            return Math.min(92, prev + Math.max(2, Math.round((92 - prev) * 0.18)));
          });
        }, 320);

        const photoUrl = `${API_BASE_URL}/meals/photo-describe`;
        if (__DEV__) {
          console.log("[meal-photo] POST", photoUrl);
        }
        const res = await fetch(photoUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            mimeType: mimeType || "image/jpeg"
          })
        });

        if (__DEV__) {
          console.log("[meal-photo] response status:", res.status, res.statusText);
        }

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to analyze meal photo.");
        }

        const payload = (await res.json()) as {
          descriptionText?: string;
          items?: Array<{ quantity?: number; unit?: string; name?: string }>;
        };

        const fromDescription = (payload.descriptionText || "").trim();
        const fromItems = (payload.items || [])
          .filter((item) => item && item.name && String(item.name).trim().length > 0)
          .map((item) => `${item.quantity || 1} ${item.unit || "serving"} ${String(item.name).trim()}`)
          .join("\n");
        const nextDescription = fromDescription || fromItems;

        if (!nextDescription) {
          throw new Error("Could not identify foods in that image. Try retaking with better lighting.");
        }

        setMealPhotoStatusText("Applying detected foods...");
        setMealPhotoProgress(98);
        setEntryText((prev) => (prev.trim() ? `${prev.trim()}\n${nextDescription}` : nextDescription));
        setAddComposerTab("text");
        setTimeout(() => addInputRef.current?.focus(), 120);
      } finally {
        if (progressTimer) {
          clearInterval(progressTimer);
        }
        setMealPhotoProgress(100);
        setTimeout(() => {
          setMealPhotoAnalyzing(false);
          setMealPhotoStatusText("Analyzing photo...");
          setMealPhotoProgress(0);
        }, 250);
      }
    },
    []
  );

  const handleTakeMealPhoto = useCallback(async () => {
    Keyboard.dismiss();
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!permission?.granted) {
        setError("Camera permission is required to analyze meal photos.");
        return;
      }
      if (!cameraRef.current) {
        setError("Camera is still loading. Please try again.");
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.25,
        base64: true,
        skipProcessing: true
      });
      if (!photo?.base64) {
        setError("Could not process that image. Please try again.");
        return;
      }

      // Keep payload safely below backend/OpenAI limits.
      if (photo.base64.length > 5_500_000) {
        setError("Photo is too large to analyze. Please move a bit farther away and retake.");
        return;
      }
      setMealPhotoUri(photo.uri || null);
      await analyzeMealPhoto(photo.base64, "image/jpeg");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze meal photo.";
      setError(message);
      maybeShowNoFoodFoundAlert(message);
      setMealPhotoAnalyzing(false);
      setMealPhotoProgress(0);
    }
  }, [analyzeMealPhoto, cameraPermission, maybeShowNoFoodFoundAlert, requestCameraPermission]);

  const handlePickMealPhotoFromGallery = useCallback(async () => {
    Keyboard.dismiss();
    try {
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        setError("Photo library permission is required to choose meal photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.25,
        base64: true,
        selectionLimit: 1
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        setError("Could not process that image. Please try another photo.");
        return;
      }

      if (asset.base64.length > 5_500_000) {
        setError("Photo is too large to analyze. Please choose a smaller image.");
        return;
      }

      setMealPhotoUri(asset.uri || null);
      await analyzeMealPhoto(asset.base64, asset.mimeType || "image/jpeg");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze meal photo.";
      setError(message);
      maybeShowNoFoodFoundAlert(message);
      setMealPhotoAnalyzing(false);
      setMealPhotoProgress(0);
    }
  }, [analyzeMealPhoto, maybeShowNoFoodFoundAlert]);

  const handleSelectPhotoTab = useCallback(async () => {
    if (mealPhotoAnalyzing) return;
    if (isPro) {
      setAddComposerTab("photo");
      return;
    }
    const purchased = await presentPaywall();
    if (purchased) {
      setAddComposerTab("photo");
    }
  }, [isPro, mealPhotoAnalyzing, presentPaywall]);

  useEffect(() => {
    if (view !== "add" || isTemplateMode || addComposerTab !== "photo") return;
    if (hasAutoOpenedCamera) return;
    setHasAutoOpenedCamera(true);
    if (!cameraPermission?.granted) {
      requestCameraPermission().catch(() => {
        setError("Camera permission is required to analyze meal photos.");
      });
    }
  }, [
    view,
    isTemplateMode,
    addComposerTab,
    hasAutoOpenedCamera,
    cameraPermission?.granted,
    requestCameraPermission
  ]);

  const openAdd = (mealId: string) => {
    setSelectedMealId(mealId);
    setError(null);
    setIsTemplateMode(false);
    setEditingTemplateId(null);
    setMealPhotoUri(null);
    setMealPhotoAnalyzing(false);
    setMealPhotoProgress(0);
    setAddComposerTab("text");
    setAddKeyboardOffset(0);
    setHasAutoOpenedCamera(false);
    setBarcodePreview(null);
    setBarcodeGramsInput("");
    barcodeScanLastCodeRef.current = "";
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
        if (__DEV__) {
          console.log(
            "[meal-log] skipped POST /meals/nl-log — text matched known foods cache (no API call)"
          );
        }
        resolvedItems = cached;
      } else {
        try {
          const nlLogUrl = `${API_BASE_URL}/meals/nl-log`;
          if (__DEV__) {
            console.log("[meal-log] POST", nlLogUrl);
          }
          const res = await fetch(nlLogUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: entryText,
              startedAt: `${selectedDate}T12:00:00.000Z`,
              tzOffsetMinutes: new Date().getTimezoneOffset()
            })
          });
          if (__DEV__) {
            console.log("[meal-log] response status:", res.status, res.statusText);
          }
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            if (__DEV__) {
              console.warn("[meal-log] error body:", payload);
            }
            throw new Error(payload?.error || "Failed to log meal.");
          }
          const data = (await res.json()) as MealResponse & { items?: MealItem[]; notes?: string[] };
          const apiItems = data.items || [];
          if (__DEV__ && Array.isArray(data.notes) && data.notes.length > 0) {
            console.log("[meal-log] API notes:", data.notes);
          }
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
            if (__DEV__) {
              console.warn(
                "[meal-log] API returned OK but 0 items — using on-device estimate. " +
                  "On Render, if OPENAI_API_KEY is unset, the server only recognizes a tiny demo list (e.g. oats, blueberry, milk); " +
                  "arbitrary phrases like \"zebra muffin\" yield empty items while the DB meal row may still be created."
              );
            }
            resolvedItems = parseFoodTextLocally(entryText);
            if (resolvedItems.length === 0) {
              throw new Error("Could not parse any foods. Try formats like \"100g chicken\" or \"2 eggs\".");
            }
          }
        } catch (apiErr) {
          if (__DEV__) {
            console.warn(
              "[meal-log] request failed (showing error if local parse also fails):",
              apiErr instanceof Error ? apiErr.message : apiErr
            );
          }
          const localItems = parseFoodTextLocally(entryText);
          if (localItems.length > 0) {
            if (__DEV__) {
              console.warn(
                "[meal-log] using offline local parse fallback; API was not used for this meal."
              );
            }
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
      
      // Mark that user has logged a meal
      try {
        const hasLoggedMeal = await AsyncStorage.getItem(HAS_LOGGED_MEAL_KEY);
        if (!hasLoggedMeal) {
          await AsyncStorage.setItem(HAS_LOGGED_MEAL_KEY, "true");
        }
      } catch (err) {
        console.warn("Error marking meal as logged:", err);
      }
      
      if (selectedDate === todayKey) {
        updateMealReminderSchedule(mealReminderSettings, true).catch((err) => {
          console.warn("Failed to cancel meal reminder after logging meal:", err);
        });
        syncMealReminderStateToBackend(mealReminderSettings, true).catch((err) => {
          console.warn("Failed to sync reminder state after logging meal:", err);
        });
      }
      setEntryText("");
      setMealPhotoUri(null);
      setMealPhotoAnalyzing(false);
      setMealPhotoProgress(0);
      setAddComposerTab("text");
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

  const lookupBarcodeProduct = useCallback(async (code: string) => {
    const clean = code.replace(/\D/g, "");
    if (clean.length < 8) return;
    setBarcodeLookupLoading(true);
    setError(null);
    try {
      const url = `${BARCODE_API_BASE_URL}/foods/barcode/${encodeURIComponent(clean)}`;
      if (__DEV__) {
        console.log("[barcode] GET", url);
      }
      const res = await fetch(url);
      const json = (await res.json()) as BarcodePreview & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Product not found");
      }
      if (!json.found || !json.nutrients) {
        throw new Error(json.error || "Product not found");
      }
      setBarcodePreview(json);
      setBarcodeGramsInput(formatBarcodeGramsDefault(json.servingGrams));
    } catch (err) {
      let message = err instanceof Error ? err.message : "Barcode lookup failed";
      if (
        typeof message === "string" &&
        (message.includes("Network request failed") ||
          message.includes("Could not connect") ||
          message.includes("Failed to connect"))
      ) {
        message =
          "Could not reach the server for barcode lookup. Check Wi‑Fi and try again. (Tip: barcode uses the hosted API when your dev URL is a LAN address.)";
      }
      setError(message);
      setBarcodePreview(null);
      setBarcodeGramsInput("");
    } finally {
      setBarcodeLookupLoading(false);
    }
  }, []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (addComposerTab !== "barcode") return;
      if (barcodeLookupLoading || barcodePreview) return;
      const raw = result?.data?.trim() ?? "";
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 14) return;
      const now = Date.now();
      if (digits === barcodeScanLastCodeRef.current && now - barcodeScanLastTsRef.current < 2500) {
        return;
      }
      barcodeScanLastTsRef.current = now;
      barcodeScanLastCodeRef.current = digits;
      void lookupBarcodeProduct(digits);
    },
    [addComposerTab, barcodeLookupLoading, barcodePreview, lookupBarcodeProduct]
  );

  const handleBarcodeCommit = useCallback(async () => {
    if (!selectedMealId || !barcodePreview?.nutrients) return;
    const gramsLogged = parseBarcodeGramsInput(barcodeGramsInput);
    if (gramsLogged == null) {
      setError("Enter a valid amount in grams (greater than 0).");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const displayName = barcodePreview.brand
        ? `${barcodePreview.productName} (${barcodePreview.brand})`
        : barcodePreview.productName;
      const baseServing =
        Number.isFinite(barcodePreview.servingGrams) && barcodePreview.servingGrams > 0
          ? barcodePreview.servingGrams
          : 100;
      const nutrientsForLogged = scaleTotals(barcodePreview.nutrients, gramsLogged / baseServing);
      const item: MealItem = {
        id: `barcode-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: displayName,
        quantity: gramsLogged,
        unit: "g",
        grams: gramsLogged,
        nutrients: nutrientsForLogged
      };
      const finalItems: MealItem[] = [item].map((it) => {
        const key = normalizeFoodNameForKey(it.name);
        const override = foodOverrides[key];
        return override ? { ...it, nutrients: override } : it;
      });
      const resolvedTotals = finalItems.reduce(
        (acc, row) => sumTotals(acc, row.nutrients),
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

      if (finalItems.length > 0) {
        const nameMap = new Map<string, string>();
        knownFoods.forEach((name) => {
          const key = normalizeFoodNameForDedup(name);
          if (key) nameMap.set(key, name);
        });
        finalItems.forEach((row) => {
          if (row && row.name) {
            const normalizedKey = normalizeFoodNameForDedup(row.name);
            const canonical = getCanonicalFoodName(row.name);
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
        finalItems.forEach((row) => {
          if (row && row.name) {
            const canonical = getCanonicalFoodName(row.name);
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

      try {
        const hasLoggedMeal = await AsyncStorage.getItem(HAS_LOGGED_MEAL_KEY);
        if (!hasLoggedMeal) {
          await AsyncStorage.setItem(HAS_LOGGED_MEAL_KEY, "true");
        }
      } catch (err) {
        console.warn("Error marking meal as logged:", err);
      }

      if (selectedDate === todayKey) {
        updateMealReminderSchedule(mealReminderSettings, true).catch((err) => {
          console.warn("Failed to cancel meal reminder after logging meal:", err);
        });
        syncMealReminderStateToBackend(mealReminderSettings, true).catch((err) => {
          console.warn("Failed to sync reminder state after logging meal:", err);
        });
      }

      setBarcodePreview(null);
      setBarcodeGramsInput("");
      barcodeScanLastCodeRef.current = "";
      setAddComposerTab("text");
      setView("home");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add item";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    selectedMealId,
    barcodePreview,
    barcodeGramsInput,
    foodOverrides,
    getDayData,
    selectedDate,
    dataByDate,
    knownFoods,
    foodServingGrams,
    todayKey,
    mealReminderSettings,
    updateMealReminderSchedule,
    syncMealReminderStateToBackend,
    persistData
  ]);

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

  const buildProfileFromInputs = (): UserProfile => {
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
      activityLevel: userProfile.activityLevel,
      customTargets: userProfile.customTargets ?? null
    };
    return updatedProfile;
  };

  const handleSaveProfile = async () => {
    const calories = parseFloat(customCaloriesInput);
    const protein = parseFloat(customProteinInput);
    const carbs = parseFloat(customCarbsInput);
    const fat = parseFloat(customFatInput);
    const hasCustomInputs = [calories, protein, carbs, fat].every((n) => Number.isFinite(n));
    if (hasCustomInputs) {
      if (calories < 800 || calories > 6000) {
        setCustomTargetError("Calories must be between 800 and 6000.");
        return;
      }
      if (protein < 20 || protein > 400 || carbs < 20 || carbs > 700 || fat < 10 || fat > 250) {
        setCustomTargetError("Protein/carbs/fat values are out of range.");
        return;
      }
      setCustomTargetError(null);
    }

    const baseProfile = buildProfileFromInputs();
    const updatedProfile: UserProfile = {
      ...baseProfile,
      customTargets: hasCustomInputs
        ? {
            calories_kcal: Math.round(calories),
            protein_g: Math.round(protein),
            carbs_g: Math.round(carbs),
            fat_g: Math.round(fat)
          }
        : null
    };
    
    setUserProfile(updatedProfile);
    await persistProfile(updatedProfile);
    await persistMealReminder(mealReminderSettings);
    try {
      const todayKey = toDateKey(new Date());
      const dayData = dataByDate[todayKey] ?? getDefaultDayData();
      const hasMealsToday = dayHasMeals(dayData);
      updateMealReminderSchedule(mealReminderSettings, hasMealsToday).catch((err) => {
        console.warn("Failed to update meal reminder schedule after saving profile:", err);
      });
      syncMealReminderStateToBackend(mealReminderSettings, hasMealsToday).catch((err) => {
        console.warn("Failed to sync reminder state after saving profile:", err);
      });
    } catch (err) {
      console.warn("Error updating meal reminder schedule:", err);
    }
    setView("home");
  };

  const handleFinishOnboarding = async () => {
    const calories = parseFloat(customCaloriesInput);
    const protein = parseFloat(customProteinInput);
    const carbs = parseFloat(customCarbsInput);
    const fat = parseFloat(customFatInput);
    if (!Number.isFinite(calories) || !Number.isFinite(protein) || !Number.isFinite(carbs) || !Number.isFinite(fat)) {
      setCustomTargetError("Please enter all recommendation values.");
      return;
    }
    if (calories < 800 || calories > 6000) {
      setCustomTargetError("Calories must be between 800 and 6000.");
      return;
    }
    if (protein < 20 || protein > 400 || carbs < 20 || carbs > 700 || fat < 10 || fat > 250) {
      setCustomTargetError("Protein/carbs/fat values are out of range.");
      return;
    }
    setCustomTargetError(null);
    const updatedProfile = {
      ...buildProfileFromInputs(),
      customTargets: {
        calories_kcal: Math.round(calories),
        protein_g: Math.round(protein),
        carbs_g: Math.round(carbs),
        fat_g: Math.round(fat)
      }
    };
    setUserProfile(updatedProfile);
    await persistProfile(updatedProfile);
    setView("home");
    if (!isPro) {
      hasShownLaunchPaywallRef.current = true;
      setTimeout(() => {
        presentPaywall().catch((err) => {
          console.warn("Failed to present paywall after onboarding:", err);
        });
      }, 220);
    }
  };

  if (view === "onboarding") {
    const goalOptions = [
      { id: "weight_loss", label: "Lose weight" },
      { id: "weight_gain", label: "Gain weight" },
      { id: "maintain_weight", label: "Maintain weight" },
      { id: "muscle_gain", label: "Build muscle" },
      { id: "reduce_cholesterol", label: "Reduce cholesterol" },
      { id: "diabetes_management", label: "Manage diabetes" },
      { id: "heart_health", label: "Healthy heart" }
    ] as const;
    const activityOptions = [
      { id: "low", label: "Low" },
      { id: "medium", label: "Moderate" },
      { id: "high", label: "High" }
    ] as const;
    const genderOptions = [
      { id: "male", label: "Male" },
      { id: "female", label: "Female" },
      { id: "other", label: "Other" }
    ] as const;
    const genderLabel =
      genderOptions.find((g) => g.id === userProfile.genderAtBirth)?.label || "Select";
    const activityLabel =
      activityOptions.find((a) => a.id === userProfile.activityLevel)?.label || "Select";
    const dobDate = (() => {
      const m = dobValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) return new Date(1980, 0, 1);
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const year = parseInt(m[3], 10);
      if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
        return new Date(1980, 0, 1);
      }
      return new Date(year, Math.max(0, month - 1), Math.max(1, day));
    })();
    const onboardingDobIso = (() => {
      const m = dobValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) return null;
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const year = parseInt(m[3], 10);
      if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    })();
    const onboardingAge = onboardingDobIso ? getAgeFromDOB(onboardingDobIso) : null;
    const targets = getMacroTargets({
      ...userProfile,
      heightCm: heightValue ? (heightUnit === "in" ? parseFloat(heightValue) * 2.54 : parseFloat(heightValue)) : null,
      weightKg: weightValue ? (weightUnit === "lbs" ? parseFloat(weightValue) / 2.20462 : parseFloat(weightValue)) : null
    });
    const canContinueFromGoal = Boolean(userProfile.goal);
    const canContinueFromProfile =
      Boolean(dobValue && userProfile.genderAtBirth && heightValue && weightValue && userProfile.activityLevel);

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={styles.onboardingContainer}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {onboardingStep === 0 && (
            <>
              <Text style={styles.onboardingTitle}>Let’s personalize your plan</Text>
              <Text style={styles.onboardingSubtitle}>
                A few quick questions to tailor calories, macros, and meal suggestions.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setOnboardingStep(1)}
              >
                <Text style={styles.primaryButtonText}>Get started</Text>
              </TouchableOpacity>
            </>
          )}

              {onboardingStep === 1 && (
            <>
              <Text style={styles.onboardingTitle}>What’s your main goal?</Text>
              <View style={styles.onboardingList}>
                {goalOptions.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.onboardingListRow}
                    onPress={() => setUserProfile((prev) => ({ ...prev, goal: g.id }))}
                  >
                    <Text style={styles.onboardingListText}>{g.label}</Text>
                    <Text style={styles.onboardingListCheck}>
                      {userProfile.goal === g.id ? "✓" : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.onboardingFootnote}>You can change this anytime</Text>
              <TouchableOpacity
                style={[styles.primaryButton, !canContinueFromGoal && styles.primaryButtonDisabled]}
                onPress={() => canContinueFromGoal && setOnboardingStep(2)}
                disabled={!canContinueFromGoal}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOnboardingStep(0)} style={styles.onboardingBackLink}>
                <Text style={styles.onboardingBackLinkText}>Previous</Text>
              </TouchableOpacity>
            </>
          )}

              {onboardingStep === 2 && (
            <>
              <Text style={styles.onboardingTitle}>Basic Profile</Text>
              <Text style={styles.onboardingSubtitleSmall}>Tell us about you</Text>
              <View style={styles.onboardingList}>
                <View style={styles.onboardingFieldRow}>
                  <View style={styles.onboardingDobLabelWrap}>
                    <Text style={styles.onboardingFieldLabel}>Date of birth</Text>
                    {onboardingAge !== null ? (
                      <Text style={styles.onboardingAgeText}>({onboardingAge} years)</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.onboardingFieldInput}
                    onPress={() => {
                      setOnboardingDobDraft(dobDate);
                      setShowOnboardingDobPicker(true);
                    }}
                  >
                    <Text style={styles.onboardingFieldInputText}>{dobValue || "Select"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.onboardingFieldRow}>
                  <Text style={styles.onboardingFieldLabel}>Gender</Text>
                  <TouchableOpacity
                    style={styles.onboardingFieldInput}
                    onPress={() => setShowOnboardingGenderDropdown(true)}
                  >
                    <Text style={styles.onboardingFieldInputText}>{genderLabel}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.onboardingFieldRow}>
                  <Text style={styles.onboardingFieldLabel}>Height</Text>
                  <View style={styles.inlineInputRow}>
                    <TextInput
                      value={heightValue}
                      onChangeText={setHeightValue}
                      placeholder="181"
                      style={styles.onboardingFieldInputSmall}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={styles.onboardingUnitText}
                      onPress={() => setShowOnboardingHeightUnitDropdown(true)}
                    >
                      <Text style={styles.onboardingFieldInputText}>{heightUnit}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.onboardingFieldRow}>
                  <Text style={styles.onboardingFieldLabel}>Current weight</Text>
                  <View style={styles.inlineInputRow}>
                    <TextInput
                      value={weightValue}
                      onChangeText={setWeightValue}
                      placeholder="72.5"
                      style={styles.onboardingFieldInputSmall}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={styles.onboardingUnitText}
                      onPress={() => setShowOnboardingWeightUnitDropdown(true)}
                    >
                      <Text style={styles.onboardingFieldInputText}>{weightUnit}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.onboardingFieldRow}>
                  <Text style={styles.onboardingFieldLabel}>Activity level</Text>
                  <TouchableOpacity
                    style={styles.onboardingFieldInput}
                    onPress={() => setShowOnboardingActivityDropdown(true)}
                  >
                    <Text style={styles.onboardingFieldInputText}>{activityLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.onboardingFootnote}>You can change this anytime</Text>
              <TouchableOpacity
                style={[styles.primaryButton, !canContinueFromProfile && styles.primaryButtonDisabled]}
                onPress={() => {
                  if (!canContinueFromProfile) return;
                  setCustomCaloriesInput(String(Math.round(targets.calories_kcal)));
                  setCustomProteinInput(String(Math.round(targets.protein_g)));
                  setCustomCarbsInput(String(Math.round(targets.carbs_g)));
                  setCustomFatInput(String(Math.round(targets.fat_g)));
                  setOnboardingStep(3);
                }}
                disabled={!canContinueFromProfile}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOnboardingStep(1)} style={styles.onboardingBackLink}>
                <Text style={styles.onboardingBackLinkText}>Previous</Text>
              </TouchableOpacity>
            </>
          )}

              {onboardingStep === 3 && (
            <>
              <Text style={styles.onboardingTitle}>Our recommendation</Text>
              <Text style={styles.onboardingSubtitleSmall}>Daily values based on your input</Text>
              <View style={styles.onboardingList}>
                <View style={styles.onboardingSummaryRow}>
                  <Text style={styles.onboardingFieldLabel}>Calories (kcal)</Text>
                  <TextInput
                    value={customCaloriesInput}
                    onChangeText={setCustomCaloriesInput}
                    style={styles.onboardingValueInput}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.onboardingSummaryRow}>
                  <Text style={styles.onboardingFieldLabel}>Protein (g)</Text>
                  <TextInput
                    value={customProteinInput}
                    onChangeText={setCustomProteinInput}
                    style={styles.onboardingValueInput}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.onboardingSummaryRow}>
                  <Text style={styles.onboardingFieldLabel}>Carbohydrates (g)</Text>
                  <TextInput
                    value={customCarbsInput}
                    onChangeText={setCustomCarbsInput}
                    style={styles.onboardingValueInput}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.onboardingSummaryRow}>
                  <Text style={styles.onboardingFieldLabel}>Fat(g)</Text>
                  <TextInput
                    value={customFatInput}
                    onChangeText={setCustomFatInput}
                    style={styles.onboardingValueInput}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={styles.onboardingFootnote}>You can change this anytime</Text>
              <TouchableOpacity style={styles.sourcesNavRow} onPress={openSourcesScreen} activeOpacity={0.8}>
                <Text style={styles.sourcesNavText}>Sources & methodology</Text>
                <Text style={styles.sourcesNavChevron}>›</Text>
              </TouchableOpacity>
              {customTargetError ? <Text style={styles.addError}>{customTargetError}</Text> : null}
              <TouchableOpacity style={styles.primaryButton} onPress={handleFinishOnboarding}>
                <Text style={styles.primaryButtonText}>Start tracking</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOnboardingStep(2)} style={styles.onboardingBackLink}>
                <Text style={styles.onboardingBackLinkText}>Previous</Text>
              </TouchableOpacity>
            </>
              )}
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
        <Modal visible={showOnboardingDobPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOnboardingDobPicker(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.onboardingDobModal} onPress={() => {}}>
              <View style={styles.onboardingDobModalHeader}>
                <TouchableOpacity onPress={() => setShowOnboardingDobPicker(false)}>
                  <Text style={styles.manageSubscriptionButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const d = onboardingDobDraft.getDate();
                    const m = onboardingDobDraft.getMonth() + 1;
                    const y = onboardingDobDraft.getFullYear();
                    setDobValue(`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
                    setShowOnboardingDobPicker(false);
                  }}
                >
                  <Text style={styles.manageSubscriptionButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={onboardingDobDraft}
                mode="date"
                maximumDate={new Date()}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  if (event.type === "dismissed" || !selectedDate) return;
                  setOnboardingDobDraft(selectedDate);
                }}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        <Modal visible={showOnboardingGenderDropdown} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOnboardingGenderDropdown(false)}
          >
            <View style={styles.dropdownContent}>
              {genderOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setUserProfile((prev) => ({ ...prev, genderAtBirth: option.id }));
                    setShowOnboardingGenderDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal visible={showOnboardingHeightUnitDropdown} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOnboardingHeightUnitDropdown(false)}
          >
            <View style={styles.dropdownContent}>
              {["cm", "in"].map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setHeightUnit(unit as "cm" | "in");
                    setShowOnboardingHeightUnitDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal visible={showOnboardingWeightUnitDropdown} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOnboardingWeightUnitDropdown(false)}
          >
            <View style={styles.dropdownContent}>
              {["kg", "lbs"].map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setWeightUnit(unit as "kg" | "lbs");
                    setShowOnboardingWeightUnitDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal visible={showOnboardingActivityDropdown} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOnboardingActivityDropdown(false)}
          >
            <View style={styles.dropdownContent}>
              {activityOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setUserProfile((prev) => ({
                      ...prev,
                      activityLevel: option.id as "low" | "medium" | "high"
                    }));
                    setShowOnboardingActivityDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    );
  }

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
      { label: "Female", value: "female" },
      { label: "Other", value: "other" }
    ];

    const goalOptions = goals.map((g) => ({ label: g.label, value: g.id }));
    const activityOptions = activityLevels.map((a) => ({ label: a.label, value: a.id }));
    const currentTargets = getMacroTargets(userProfile);

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
            <Text style={styles.fieldLabel}>Subscription</Text>
            <View style={styles.subscriptionRightRow}>
              <Text style={styles.subscriptionStatusText}>
                {subscriptionLoading ? "Loading..." : isPro ? "Pro" : "Free"}
              </Text>
              {!subscriptionLoading && !isPro ? (
                <TouchableOpacity style={styles.upgradeInlineButton} onPress={() => presentPaywall()}>
                  <Text style={styles.upgradeInlineButtonText}>Upgrade</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.manageSubscriptionButton}
            onPress={() => presentCustomerCenter()}
          >
            <Text style={styles.manageSubscriptionButtonText}>Manage Subscription</Text>
          </TouchableOpacity>

          <Text style={styles.personalSectionTitle}>PROFILE</Text>

          {/* DATE OF BIRTH */}
          {(() => {
            const match = dobValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            const day = match ? parseInt(match[1], 10) : NaN;
            const month = match ? parseInt(match[2], 10) : NaN;
            const year = match ? parseInt(match[3], 10) : NaN;
            const isValidDob =
              !!match &&
              Number.isFinite(day) &&
              Number.isFinite(month) &&
              Number.isFinite(year) &&
              day >= 1 &&
              day <= 31 &&
              month >= 1 &&
              month <= 12;
            const dobDate = isValidDob ? new Date(year, month - 1, day) : new Date(1990, 0, 1);
            const dobIso = isValidDob
              ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : null;
            const age = dobIso ? getAgeFromDOB(dobIso) : null;

            return (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Date of birth</Text>
                    {age ? <Text style={styles.fieldMetaText}>({age} years)</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={styles.fieldValue}
                    onPress={() => {
                      setOnboardingDobDraft(dobDate);
                      setShowOnboardingDobPicker(true);
                    }}
                  >
                    <Text style={styles.fieldValueText}>{dobValue || "Select"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}

          {/* GENDER */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
            >
              <Text style={styles.fieldValueText}>
                {userProfile.genderAtBirth
                  ? userProfile.genderAtBirth === "male"
                    ? "Male"
                    : userProfile.genderAtBirth === "female"
                      ? "Female"
                      : "Other"
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
                        setUserProfile({ ...userProfile, genderAtBirth: option.value as "male" | "female" | "other" });
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
            <Text style={styles.fieldLabel}>Height</Text>
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
            <Text style={styles.fieldLabel}>Current weight</Text>
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
            <Text style={styles.fieldLabel}>Goal</Text>
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
            <Text style={styles.fieldLabel}>Activity level</Text>
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

          <Modal visible={showOnboardingDobPicker} transparent animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowOnboardingDobPicker(false)}
            >
              <TouchableOpacity activeOpacity={1} style={styles.onboardingDobModal} onPress={() => {}}>
                <View style={styles.onboardingDobModalHeader}>
                  <TouchableOpacity onPress={() => setShowOnboardingDobPicker(false)}>
                    <Text style={styles.manageSubscriptionButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const d = onboardingDobDraft.getDate();
                      const m = onboardingDobDraft.getMonth() + 1;
                      const y = onboardingDobDraft.getFullYear();
                      setDobValue(`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
                      setShowOnboardingDobPicker(false);
                    }}
                  >
                    <Text style={styles.manageSubscriptionButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={onboardingDobDraft}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    if (event.type === "dismissed" || !selectedDate) return;
                    setOnboardingDobDraft(selectedDate);
                  }}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <Text style={[styles.personalSectionTitle, styles.personalSectionTitleSpaced]}>RECOMMENDATIONS</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Calories (kcal)</Text>
            <TextInput
              style={[styles.fieldValue, styles.fieldValueInput]}
              value={customCaloriesInput}
              onChangeText={setCustomCaloriesInput}
              placeholder={String(Math.round(currentTargets.calories_kcal))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Protein (g)</Text>
            <TextInput
              style={[styles.fieldValue, styles.fieldValueInput]}
              value={customProteinInput}
              onChangeText={setCustomProteinInput}
              placeholder={String(Math.round(currentTargets.protein_g))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Carbohydrates (g)</Text>
            <TextInput
              style={[styles.fieldValue, styles.fieldValueInput]}
              value={customCarbsInput}
              onChangeText={setCustomCarbsInput}
              placeholder={String(Math.round(currentTargets.carbs_g))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Fat (g)</Text>
            <TextInput
              style={[styles.fieldValue, styles.fieldValueInput]}
              value={customFatInput}
              onChangeText={setCustomFatInput}
              placeholder={String(Math.round(currentTargets.fat_g))}
              keyboardType="numeric"
            />
          </View>
          {customTargetError ? <Text style={styles.addError}>{customTargetError}</Text> : null}
          <TouchableOpacity style={styles.sourcesNavRow} onPress={openSourcesScreen} activeOpacity={0.8}>
            <Text style={styles.sourcesNavText}>Sources & methodology</Text>
            <Text style={styles.sourcesNavChevron}>›</Text>
          </TouchableOpacity>
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
            .map((name) => {
              const lower = name.toLowerCase();
              // Priority:
              // 1) starts with whole query
              // 2) any word starts with query
              // 3) query appears anywhere
              const starts = lower.startsWith(foodNamePart);
              const wordStarts = lower.split(/\s+/).some((w) => w.startsWith(foodNamePart));
              const contains = lower.includes(foodNamePart);
              const score = starts ? 0 : wordStarts ? 1 : contains ? 2 : 99;
              return { name, score };
            })
            .filter((x) => x.score < 99)
            .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
            .map((x) => x.name)
            .slice(0, 5);
    const defaultSavedMeals = mealTemplates.slice(0, 5);

    if (!isTemplateMode) {
      return (
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.addCameraScreen}
            behavior={undefined}
          >
            <View style={[styles.addHeader, { paddingHorizontal: 12, paddingTop: 8 }]}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setView("home");
                  setEntryText("");
                  setMealPhotoUri(null);
                  setMealPhotoAnalyzing(false);
                  setMealPhotoProgress(0);
                  setAddComposerTab("text");
                }}
              >
                <Text style={styles.iconText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Add item(s)</Text>
              <View style={styles.iconButton} />
            </View>

            <View style={styles.addCameraStage}>
              {addComposerTab === "barcode" && cameraPermission?.granted ? (
                barcodeLookupLoading || barcodePreview ? (
                  <View style={[styles.addCameraImage, styles.addBarcodeCameraPaused]}>
                    {barcodeLookupLoading ? (
                      <>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.addBarcodeCameraPausedText}>Looking up product…</Text>
                      </>
                    ) : (
                      <Text style={styles.addBarcodeCameraPausedText}>Product found — enter grams below</Text>
                    )}
                  </View>
                ) : (
                  <CameraView
                    style={styles.addCameraImage}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"]
                    }}
                    onBarcodeScanned={handleBarcodeScanned}
                    active
                  />
                )
              ) : addComposerTab === "photo" && isPro && cameraPermission?.granted && !(mealPhotoAnalyzing && mealPhotoUri) ? (
                <CameraView ref={cameraRef} style={styles.addCameraImage} facing="back" />
              ) : mealPhotoUri ? (
                <Image source={{ uri: mealPhotoUri }} style={styles.addCameraImage} resizeMode="cover" />
              ) : (
                <View style={styles.addCameraPlaceholder}>
                  <Text style={styles.addCameraPlaceholderText}>
                    {addComposerTab === "photo" && !isPro
                      ? "Take photo is available on Pro."
                      : addComposerTab === "photo"
                      ? "Camera permission is required to capture meal photos."
                      : addComposerTab === "barcode"
                      ? "Allow camera access to scan product barcodes (EAN / UPC)."
                      : "Take a meal photo to start"}
                  </Text>
                  {addComposerTab === "photo" && !isPro ? (
                    <TouchableOpacity style={styles.addCameraPermissionButton} onPress={() => presentPaywall()}>
                      <Text style={styles.addCameraPermissionButtonText}>Upgrade to Pro</Text>
                    </TouchableOpacity>
                  ) : addComposerTab === "photo" ? (
                    <TouchableOpacity
                      style={styles.addCameraPermissionButton}
                      onPress={requestCameraPermission}
                    >
                      <Text style={styles.addCameraPermissionButtonText}>Enable camera</Text>
                    </TouchableOpacity>
                  ) : addComposerTab === "barcode" && !cameraPermission?.granted ? (
                    <TouchableOpacity
                      style={styles.addCameraPermissionButton}
                      onPress={requestCameraPermission}
                    >
                      <Text style={styles.addCameraPermissionButtonText}>Enable camera</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {mealPhotoAnalyzing && (
                <View style={styles.addCameraAnalyzingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.addCameraAnalyzingText}>
                    {mealPhotoStatusText} {mealPhotoProgress}%
                  </Text>
                </View>
              )}

              {addComposerTab === "photo" && isPro && (
                <TouchableOpacity
                  style={styles.addShutterWrap}
                  onPress={handleTakeMealPhoto}
                  disabled={mealPhotoAnalyzing}
                  activeOpacity={0.85}
                >
                  <View style={styles.addShutterOuter}>
                    <View style={styles.addShutterInner} />
                  </View>
                </TouchableOpacity>
              )}

              {addComposerTab === "photo" && isPro && (
                <TouchableOpacity
                  style={[styles.addGalleryButton, mealPhotoAnalyzing && styles.addPhotoButtonDisabled]}
                  onPress={handlePickMealPhotoFromGallery}
                  disabled={mealPhotoAnalyzing}
                  activeOpacity={0.85}
                >
                  <Image
                    source={require("./assets/add-gallery-icon.png")}
                    style={styles.addGalleryButtonIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </View>

            {addComposerTab === "text" && addKeyboardOffset > 0 && (
              <View
                pointerEvents="none"
                style={[styles.addKeyboardUnderlay, { height: addKeyboardOffset + 36 }]}
              />
            )}

            <View
              style={[
                styles.addFloatingComposer,
                addKeyboardOffset > 0 && { bottom: Math.max(-22, addKeyboardOffset - 22) },
                (addComposerTab === "text" || addComposerTab === "barcode") &&
                  styles.addFloatingComposerExpanded,
                addComposerTab === "barcode" && styles.addFloatingComposerBarcode
              ]}
            >
              <View style={styles.addComposerTabsRow}>
                <TouchableOpacity
                  style={styles.addComposerTab}
                  onPress={() => {
                    Keyboard.dismiss();
                    setAddComposerTab("text");
                  }}
                  disabled={mealPhotoAnalyzing}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.addComposerTabPill,
                      addComposerTab === "text" && styles.addComposerTabPillActive
                    ]}
                  >
                    <TabIcon
                      source={require("./assets/add-tab-text-grey.png")}
                      size={26}
                      tintColor={addComposerTab === "text" ? "#1D4ED8" : "#4B5563"}
                    />
                    <Text
                      style={[
                        styles.addComposerTabText,
                        addComposerTab === "text" && styles.addComposerTabTextActive
                      ]}
                    >
                      INPUT TEXT
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addComposerTab}
                  onPress={handleSelectPhotoTab}
                  disabled={mealPhotoAnalyzing}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.addComposerTabPill,
                      addComposerTab === "photo" && styles.addComposerTabPillActive
                    ]}
                  >
                    {!isPro ? (
                      <View style={styles.addComposerProBadge}>
                        <Text style={styles.addComposerProBadgeText}>PRO</Text>
                      </View>
                    ) : null}
                    <TabIcon
                      source={require("./assets/add-tab-camera-grey.png")}
                      size={26}
                      tintColor={addComposerTab === "photo" ? "#1D4ED8" : "#4B5563"}
                    />
                    <Text
                      style={[
                        styles.addComposerTabText,
                        addComposerTab === "photo" && styles.addComposerTabTextActive
                      ]}
                    >
                      TAKE PHOTO
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addComposerTab}
                  onPress={() => {
                    Keyboard.dismiss();
                    setAddComposerTab("barcode");
                  }}
                  disabled={mealPhotoAnalyzing}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.addComposerTabPill,
                      addComposerTab === "barcode" && styles.addComposerTabPillActive
                    ]}
                  >
                    <TabIcon
                      source={
                        addComposerTab === "barcode"
                          ? require("./assets/add-tab-barcode-active.png")
                          : require("./assets/add-tab-barcode-inactive.png")
                      }
                      size={26}
                    />
                    <Text
                      style={[
                        styles.addComposerTabText,
                        addComposerTab === "barcode" && styles.addComposerTabTextActive
                      ]}
                    >
                      SCAN BARCODE
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {addComposerTab === "text" && (
                <View style={styles.addFloatingTextContent}>
                  <TextInput
                    ref={addInputRef}
                    value={entryText}
                    onChangeText={setEntryText}
                    placeholder="Describe the food items here..."
                    placeholderTextColor="#9CA3AF"
                    style={styles.addFloatingInput}
                    multiline
                    textAlignVertical="top"
                    editable={!mealPhotoAnalyzing}
                    scrollEnabled
                  />
                  <View style={styles.addSuggestionsSlot}>
                    {suggestions.length > 0 && (
                      <View style={[styles.suggestionsContainer, styles.addFloatingSuggestionsContainer]}>
                        {suggestions.map((name) => (
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
                            <Text style={styles.suggestionText}>{name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {suggestions.length === 0 && defaultSavedMeals.length > 0 && (
                      <View style={[styles.suggestionsContainer, styles.addFloatingSuggestionsContainer]}>
                        {defaultSavedMeals.map((template) => (
                          <TouchableOpacity
                            key={template.id}
                            style={styles.suggestionChip}
                            onPress={() => {
                              setEntryText(template.items.join("\n"));
                              setMealPhotoUri(null);
                              setMealPhotoAnalyzing(false);
                              setMealPhotoProgress(0);
                            }}
                          >
                            <Text style={styles.suggestionText}>{template.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.addFloatingActions}>
                    <TouchableOpacity
                      style={styles.addFloatingCancel}
                      onPress={() => {
                        setView("home");
                        setEntryText("");
                        setMealPhotoUri(null);
                        setMealPhotoAnalyzing(false);
                        setMealPhotoProgress(0);
                        setAddComposerTab("text");
                        setAddKeyboardOffset(0);
                        setHasAutoOpenedCamera(false);
                      }}
                    >
                      <Text style={styles.addFloatingCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.addFloatingConfirm,
                        (loading || !entryText.trim()) && styles.addFloatingConfirmDisabled
                      ]}
                      onPress={handleAdd}
                      disabled={loading || !entryText.trim()}
                    >
                      <Text style={styles.addFloatingConfirmText}>
                        {loading ? "Adding..." : "Confirm"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {error ? <Text style={styles.addError}>{error}</Text> : null}
                </View>
              )}

              {addComposerTab === "barcode" && (
                <ScrollView
                  style={styles.addBarcodeMvpContent}
                  contentContainerStyle={styles.addBarcodeMvpScrollContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  <View
                    style={[
                      styles.addBarcodeMvpCard,
                      barcodePreview && styles.addBarcodeMvpCardQuantity
                    ]}
                  >
                    <View style={{ alignSelf: "center" }}>
                      <TabIcon
                        source={require("./assets/add-tab-barcode-active.png")}
                        size={40}
                      />
                    </View>
                    {barcodePreview ? (
                      <>
                        <Text style={styles.addBarcodeMvpStepTitle}>How much did you eat?</Text>
                        <Text
                          style={[styles.addBarcodeMvpTitle, styles.addBarcodeMvpProductCenter]}
                          numberOfLines={2}
                        >
                          {barcodePreview.productName}
                        </Text>
                        {barcodePreview.brand ? (
                          <Text style={[styles.addBarcodeMvpBrand, styles.addBarcodeMvpProductCenter]}>
                            {barcodePreview.brand}
                          </Text>
                        ) : null}
                        <Text style={styles.addBarcodeMvpHint}>
                          Amount (below) defaults from pack data when available — change it to match what you ate.
                        </Text>
                        <Text style={styles.addBarcodeMvpFieldLabel}>Amount (grams)</Text>
                        <TextInput
                          style={styles.addBarcodeMvpGramsInput}
                          value={barcodeGramsInput}
                          onChangeText={(t) => {
                            setBarcodeGramsInput(t);
                            setError(null);
                          }}
                          keyboardType="decimal-pad"
                          placeholder={formatBarcodeGramsDefault(barcodePreview.servingGrams)}
                          placeholderTextColor="#9CA3AF"
                          selectTextOnFocus
                        />
                        <Text style={styles.addBarcodeMvpEstimate}>
                          {(() => {
                            const g = parseBarcodeGramsInput(barcodeGramsInput);
                            const base =
                              Number.isFinite(barcodePreview.servingGrams) && barcodePreview.servingGrams > 0
                                ? barcodePreview.servingGrams
                                : 100;
                            if (g == null || !barcodePreview.nutrients) {
                              return "—";
                            }
                            const kcal = scaleTotals(barcodePreview.nutrients, g / base).calories_kcal;
                            return `~${Math.round(kcal)} kcal`;
                          })()}
                        </Text>
                        <Text style={styles.addBarcodeMvpSource}>Nutrition via Open Food Facts</Text>
                        <View style={styles.addBarcodeMvpActions}>
                          <TouchableOpacity
                            style={styles.addBarcodeMvpSecondary}
                            onPress={() => {
                              Keyboard.dismiss();
                              setBarcodePreview(null);
                              setBarcodeGramsInput("");
                              barcodeScanLastCodeRef.current = "";
                            }}
                          >
                            <Text style={styles.addBarcodeMvpSecondaryText}>Scan again</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.addBarcodeMvpPrimary,
                              loading && styles.addFloatingConfirmDisabled
                            ]}
                            onPress={() => {
                              Keyboard.dismiss();
                              void handleBarcodeCommit();
                            }}
                            disabled={loading}
                          >
                            <Text style={styles.addBarcodeMvpPrimaryText}>
                              {loading ? "Adding…" : "Add to meal"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.addBarcodeMvpTitle}>Scan a barcode</Text>
                        <Text style={styles.addBarcodeMvpBody}>
                          Aim at the product barcode. We look up nutrition on the server (Open Food Facts), then enter
                          grams and tap Add to meal.
                        </Text>
                      </>
                    )}
                  </View>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    }

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
                setMealPhotoUri(null);
                setMealPhotoAnalyzing(false);
                setMealPhotoProgress(0);
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
              {mealPhotoUri && (
                <>
                  <Image source={{ uri: mealPhotoUri }} style={styles.addCardPhotoBackground} />
                  <View style={styles.addCardPhotoOverlay} />
                </>
              )}
              <View style={styles.addCardContent}>
                {!isTemplateMode && (
                  <View style={styles.addPhotoActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.addPhotoButton,
                        mealPhotoAnalyzing && styles.addPhotoButtonDisabled
                      ]}
                      onPress={handleTakeMealPhoto}
                      disabled={mealPhotoAnalyzing}
                    >
                      <Text style={styles.addPhotoButtonText}>
                        {mealPhotoUri ? "Retake photo" : "Take meal photo"}
                      </Text>
                    </TouchableOpacity>
                    {mealPhotoUri && (
                      <TouchableOpacity
                        style={styles.addPhotoClearButton}
                        onPress={() => setMealPhotoUri(null)}
                        disabled={mealPhotoAnalyzing}
                      >
                        <Text style={styles.addPhotoClearButtonText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {mealPhotoAnalyzing && (
                  <View style={styles.addPhotoProgressRow}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.addPhotoProgressText}>
                      {mealPhotoStatusText} {mealPhotoProgress}%
                    </Text>
                  </View>
                )}
                <Text style={styles.addHint}>
                  {isTemplateMode ? "Food items (one per line)" : "Describe the food items and we will do the rest"}
                </Text>
                <TextInput
                  ref={addInputRef}
                  value={entryText}
                  onChangeText={setEntryText}
                  placeholder=""
                  style={[styles.addInput, mealPhotoUri && styles.addInputForeground]}
                  multiline
                  textAlignVertical="top"
                  editable={!mealPhotoAnalyzing}
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
                          setMealPhotoUri(null);
                          setMealPhotoAnalyzing(false);
                          setMealPhotoProgress(0);
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
                          setMealPhotoUri(null);
                          setMealPhotoAnalyzing(false);
                          setMealPhotoProgress(0);
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
    const foodUnitOptions = ["g", "ml", "piece", "bowl", "cup", "serving", "tbsp", "tsp", "slice"];
    const originalItemGrams =
      selectedFoodItem.grams ||
      quantityUnitToGrams(selectedFoodItem.quantity || 1, selectedFoodItem.unit || "g", selectedFoodItem.name) ||
      100;
    const basePer100FromOriginal = scaleTotals(originalFoodNutrients, 100 / Math.max(1, originalItemGrams));
    const recalcNutrientsForQuantityAndUnit = (nextQty: number, nextUnit: string) => {
      if (nextQty <= 0) return;
      const nextGrams = quantityUnitToGrams(nextQty, nextUnit, selectedFoodItem.name);
      if (!nextGrams || nextGrams <= 0) return;
      setEditableFoodNutrients(scaleTotals(basePer100FromOriginal, nextGrams / 100));
    };
    const quantityOrUnitChanged =
      editableQuantity !== selectedFoodItem.quantity || editableUnit !== (selectedFoodItem.unit || "g");
    const isFoodDirty =
      quantityOrUnitChanged ||
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
      const safeQty = editableQuantity > 0 ? editableQuantity : 1;
      const newGrams = quantityUnitToGrams(safeQty, editableUnit, selectedFoodItem.name);
      const newNutrients: NutrientTotals = {
        ...oldItem.nutrients,
        ...editableFoodNutrients
      };

      const updatedItem: MealItem = {
        ...oldItem,
        quantity: safeQty,
        unit: editableUnit,
        grams: newGrams,
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
        setEditableQuantity(updatedItem.quantity);
        setEditableUnit(updatedItem.unit || "g");

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
              onPress={() => {
                setShowFoodUnitDropdown(false);
                setSelectedFoodItem(null);
              }}
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
            <Text style={styles.foodDetailSectionTitle}>Quantity</Text>
            <View style={styles.foodDetailQuantityRow}>
              <TextInput
                style={styles.foodDetailQuantityInput}
                keyboardType="numeric"
                value={String(editableQuantity)}
                onChangeText={(text) => {
                  setFoodSaveMessage(null);
                  const num = parseFloat(text.replace(",", "."));
                  if (Number.isNaN(num) && text !== "" && text !== "-") return;
                  const newQty = text === "" || text === "-" ? 0 : num;
                  recalcNutrientsForQuantityAndUnit(newQty, editableUnit);
                  setEditableQuantity(newQty);
                }}
              />
              <TouchableOpacity
                style={styles.foodDetailUnitButton}
                onPress={() => setShowFoodUnitDropdown(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.foodDetailUnitButtonText}>{editableUnit}</Text>
                <Text style={styles.foodDetailUnitButtonChevron}>▾</Text>
              </TouchableOpacity>
            </View>
            <Modal visible={showFoodUnitDropdown} transparent animationType="fade">
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowFoodUnitDropdown(false)}
              >
                <View style={styles.dropdownContent}>
                  {foodUnitOptions.map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFoodSaveMessage(null);
                        setEditableUnit(unit);
                        recalcNutrientsForQuantityAndUnit(editableQuantity, unit);
                        setShowFoodUnitDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{unit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

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
    // Recalculate selectedItems from current dataByDate to ensure it's up-to-date after deletions
    const currentDayData = getDayData(selectedDate);
    const currentSelectedItems = (selectedMealId && currentDayData.mealItems[selectedMealId]) || [];
    
    const totalCalories = Math.round(
      currentSelectedItems.reduce((sum, item) => sum + item.nutrients.calories_kcal, 0)
    );
    
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
        <SafeAreaView style={{ backgroundColor: "#F5F5F7" }}>
          <View style={styles.fixedHeader}>
            <TouchableOpacity
              style={[styles.iconButton, { position: "absolute", left: 12, zIndex: 1 }]}
              onPress={() => setView("home")}
            >
              <Text style={styles.iconText}>‹</Text>
            </TouchableOpacity>
            <View style={[styles.headerCenter, { width: "100%", position: "absolute" }]}>
              <Text style={styles.headerTitle}>{selectedMealLabel}</Text>
            </View>
            <TouchableOpacity
              style={[styles.headerAddButton, { position: "absolute", right: 12, zIndex: 1 }]}
              onPress={() => {
                setEntryText("");
                setMealPhotoUri(null);
                setMealPhotoAnalyzing(false);
                setMealPhotoProgress(0);
                setAddComposerTab("text");
                setHasAutoOpenedCamera(false);
                setView("add");
              }}
            >
              <Text style={styles.headerAddText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mealDetailContent}>
          {(() => {
            const mealInsight = getMealInsight(currentSelectedItems, selectedMealLabel, userProfile);
            if (!mealInsight) return null;
            const heartIcon = mealInsight.type === "positive"
              ? require("./assets/Greenheart.png")
              : require("./assets/Orangeheart.png");
            return (
              <View key="meal-insight" style={styles.mealInsightCardWrapper}>
                <View style={[styles.mealInsightCard, !isPro && styles.proFeatureBlur]}>
                  <Image source={heartIcon} style={styles.mealInsightHeart} resizeMode="contain" />
                  <View style={styles.mealInsightContent}>
                    <Text style={styles.mealInsightText}>{mealInsight.text}</Text>
                    {mealInsight.suggestions && mealInsight.suggestions.length > 0 && (
                      <View style={styles.mealInsightSuggestions}>
                        <Text style={styles.mealInsightSuggestionsTitle}>Suggestions:</Text>
                        {mealInsight.suggestions.map((suggestion, idx) => (
                          <Text key={idx} style={styles.mealInsightSuggestionItem}>
                            • {suggestion}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                {!isPro && (
                  <TouchableOpacity
                    style={styles.proFeatureOverlayContributors}
                    onPress={() => presentPaywall()}
                    activeOpacity={1}
                  >
                    <Text style={styles.proFeatureOverlayText}>Unlock meal insights</Text>
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
            );
          })()}
          {currentSelectedItems.map((item) => (
            <SwipeableItemCard
              key={item.id}
              item={item}
              onOpenDetail={async () => {
                setSelectedFoodItem(item);
                setEditableFoodNutrients(item.nutrients);
                setOriginalFoodNutrients(item.nutrients);
                setEditableQuantity(item.quantity);
                setEditableUnit(item.unit || "g");
                setShowFoodUnitDropdown(false);
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
            <View style={styles.emptyStateContainer}>
              <Image
                source={require("./assets/Emptystate.png")}
                style={styles.emptyStateImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyStateText}>
                No food logged yet in this meal
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => {
                  setEntryText("");
                  setMealPhotoUri(null);
                  setMealPhotoAnalyzing(false);
                  setMealPhotoProgress(0);
                  setAddComposerTab("text");
                  setHasAutoOpenedCamera(false);
                  setView("add");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyStateButtonText}>Add some food</Text>
              </TouchableOpacity>
            </View>
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

  if (view === "terms" || view === "privacy") {
    const url = view === "terms" ? "https://www.joulapp.com/terms" : "https://www.joulapp.com/Privacy";
    const title = view === "terms" ? "Terms" : "Privacy";
    console.log(`Loading ${title} page: ${url}`);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.addHeader}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setView("home")}>
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          <View style={styles.iconButton} />
        </View>
        <View style={{ flex: 1 }}>
          {webViewLoading && !webViewError && (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
              <ActivityIndicator size="large" color="#4263EB" />
            </View>
          )}
          {webViewError ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
              <Text style={{ fontSize: 16, color: "#6B7280", textAlign: "center", marginBottom: 12 }}>
                Unable to load page
              </Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", marginBottom: 20 }}>
                {webViewError}
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", marginBottom: 20 }}>
                URL: {url}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: "#4263EB", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
                onPress={() => {
                  setWebViewError(null);
                  setWebViewLoading(true);
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              key={url}
              source={{ uri: url }}
              style={{ flex: 1 }}
              onLoadStart={() => {
                console.log(`WebView load started: ${url}`);
                setWebViewLoading(true);
                setWebViewError(null);
              }}
              onLoadEnd={() => {
                console.log(`WebView load ended: ${url}`);
                setWebViewLoading(false);
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error("WebView error:", {
                  code: nativeEvent.code,
                  description: nativeEvent.description,
                  domain: nativeEvent.domain,
                  url: nativeEvent.url
                });
                setWebViewLoading(false);
                setWebViewError(nativeEvent.description || `Failed to load ${url}`);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error("WebView HTTP error:", {
                  statusCode: nativeEvent.statusCode,
                  description: nativeEvent.description,
                  url: nativeEvent.url
                });
                setWebViewLoading(false);
                setWebViewError(`HTTP ${nativeEvent.statusCode}: ${nativeEvent.description || "Page not found"}`);
              }}
              cacheEnabled={false}
              sharedCookiesEnabled={false}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (view === "sources") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.addHeader}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setView(sourcesReturnViewRef.current)}
          >
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Sources & methodology</Text>
          </View>
          <View style={styles.iconButton} />
        </View>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#F5F5F7" }}
          contentContainerStyle={styles.sourcesScreenContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.analysisSourcesCard}>
            <Text style={styles.analysisSourcesTitle}>How recommendations are calculated</Text>
            <Text style={styles.analysisSourcesDisclaimer}>
              We estimate calorie needs from BMR/TDEE and activity level, then derive macro
              targets from your goals and profile inputs.
            </Text>
            <Text style={styles.analysisSourcesDisclaimer}>{HEALTH_CONTENT_DISCLAIMER}</Text>
          </View>

          <View style={styles.analysisSourcesCard}>
            <Text style={styles.analysisSourcesTitle}>Reference sources</Text>
            {HEALTH_CITATION_SOURCES.map((source) => (
              <TouchableOpacity
                key={`sources-screen-${source.url}`}
                onPress={() => openHealthCitation(source.url)}
                activeOpacity={0.7}
                style={styles.analysisSourceLinkRow}
              >
                <Text style={styles.analysisSourceLinkText}>{source.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            <View style={styles.headerInsightsCenter}>
              <Text style={styles.headerTitle}>Insights</Text>
              <TouchableOpacity
                style={styles.headerInsightsInfoButton}
                onPress={openSourcesScreen}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open sources and methodology"
              >
                <Text style={styles.headerInsightsInfoButtonText}>ⓘ</Text>
              </TouchableOpacity>
            </View>
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
            <ScrollView 
              style={styles.sidebarScrollView}
              contentContainerStyle={styles.sidebarScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeSidebar();
                  setTimeout(() => presentCustomerCenter(), 220);
                }}
              >
                <Text style={styles.menuItemText}>Manage Subscription</Text>
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
                <Text style={styles.menuItemText}>Personal details and profile</Text>
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
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTermsPrivacySubmenu(!showTermsPrivacySubmenu);
                }}
              >
                <Text style={styles.menuItemText}>Terms and Privacy</Text>
                <Text style={styles.iconText}>{showTermsPrivacySubmenu ? "›" : "›"}</Text>
              </TouchableOpacity>
              {showTermsPrivacySubmenu && (
                <>
                  <TouchableOpacity
                    style={[styles.menuItem, styles.subMenuItem]}
                    onPress={() => {
                      setShowTermsPrivacySubmenu(false);
                      closeSidebar();
                      setTimeout(() => setView("terms"), 220);
                    }}
                  >
                    <Text style={styles.subMenuItemText}>Terms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuItem, styles.subMenuItem]}
                    onPress={() => {
                      setShowTermsPrivacySubmenu(false);
                      closeSidebar();
                      setTimeout(() => setView("privacy"), 220);
                    }}
                  >
                    <Text style={styles.subMenuItemText}>Privacy</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
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

      {/* New User Paywall Modal */}
      <Modal
        visible={newUserPaywallVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={async () => {
          await AsyncStorage.setItem(NEW_USER_PAYWALL_DISMISSED_KEY, "true");
          setNewUserPaywallVisible(false);
        }}
      >
        <View style={styles.newUserPaywallOverlay}>
          <View style={styles.newUserPaywallContent}>
            <TouchableOpacity
              style={styles.newUserPaywallCloseButton}
              onPress={async () => {
                await AsyncStorage.setItem(NEW_USER_PAYWALL_DISMISSED_KEY, "true");
                setNewUserPaywallVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.newUserPaywallCloseText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.newUserPaywallBody}>
              <Text style={styles.newUserPaywallTitle}>Unlock Pro Features</Text>
              <Text style={styles.newUserPaywallSubtitle}>
                Get AI-powered insights, advanced nutrition tracking, and more to help you reach your health goals.
              </Text>
              <TouchableOpacity
                style={styles.newUserPaywallUpgradeButton}
                onPress={async () => {
                  const purchased = await presentPaywall();
                  if (purchased) {
                    await AsyncStorage.setItem(NEW_USER_PAYWALL_DISMISSED_KEY, "true");
                    setNewUserPaywallVisible(false);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.newUserPaywallUpgradeButtonText}>Upgrade to Pro</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
              <View key={`nutritionCard-${selectedDate}`} style={styles.nutritionCard}>
                {(() => {
                  const macroTargets = getMacroTargets(userProfile);
                  const items = [
                    { key: "calories_kcal" as const, label: "Calories", value: totals.calories_kcal, target: macroTargets.calories_kcal, unit: "" },
                    { key: "protein_g" as const, label: "Protein", value: totals.protein_g, target: macroTargets.protein_g, unit: "g" },
                    { key: "carbs_g" as const, label: "Carbs", value: totals.carbs_g, target: macroTargets.carbs_g, unit: "g" },
                    { key: "fat_g" as const, label: "Fat", value: totals.fat_g, target: macroTargets.fat_g, unit: "g" }
                  ];
                  return items.map((item, index) => {
                    const current = Number(item.value) || 0;
                    const target = Number(item.target) || 1;
                    const progress = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
                    // Create a completely unique identifier for this ring instance
                    // Include selectedDate to ensure each date gets fresh component instances
                    const uniqueId = `${selectedDate}-${item.key}-${index}`;
                    return (
                      <View key={`item-${uniqueId}`} style={styles.nutritionItem}>
                        <View style={styles.nutritionLabelWrap}>
                          <Text style={styles.nutritionLabel}>{item.label}</Text>
                        </View>
                        <View key={`wrapper-${uniqueId}-${progress}`} style={{ width: 72, height: 72 }}>
                          <CircularProgressRing
                            key={`ring-${uniqueId}-${progress.toFixed(6)}-${current}`}
                            progress={progress}
                            value={current}
                            size={72}
                            suffix={item.unit}
                          />
                        </View>
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
                const hasItems = mealItemsForMeal.length > 0;
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
                    <View style={styles.mealLabelRow}>
                      <Text style={styles.mealLabel}>{meal.label}</Text>
                      <TouchableOpacity
                        style={styles.addCircle}
                        onPress={() => openAdd(meal.id)}
                      >
                        <Text style={styles.addCircleText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {hasItems && meal.nutrients.calories_kcal > 0 ? (
                      <Text style={styles.mealCalories}>
                        {Math.round(meal.nutrients.calories_kcal)} Cal
                      </Text>
                    ) : null}
                    {hasItems && (meal.nutrients.protein_g > 0 || meal.nutrients.carbs_g > 0 || meal.nutrients.fat_g > 0) ? (
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

              <TouchableOpacity style={styles.sourcesNavRow} onPress={openSourcesScreen} activeOpacity={0.8}>
                <Text style={styles.sourcesNavText}>Sources & methodology</Text>
                <Text style={styles.sourcesNavChevron}>›</Text>
              </TouchableOpacity>
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

            <TouchableOpacity style={styles.sourcesNavRow} onPress={openSourcesScreen} activeOpacity={0.8}>
              <Text style={styles.sourcesNavText}>Sources & methodology</Text>
              <Text style={styles.sourcesNavChevron}>›</Text>
            </TouchableOpacity>

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
                  <>
                    <Text style={[styles.insightsSubTabLabel, insightsSubTab === "day" && styles.insightsSubTabLabelActive]}>
                      Day
                    </Text>
                    {hasNewDayInsights && (
                      <View style={styles.insightsSubTabIndicator} />
                    )}
                  </>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.insightsSubTab, insightsSubTab === "week" && styles.insightsSubTabActive]}
                  onPress={() => setInsightsSubTab("week")}
                >
                  <>
                    <Text style={[styles.insightsSubTabLabel, insightsSubTab === "week" && styles.insightsSubTabLabelActive]}>
                      Week
                    </Text>
                    {hasNewWeekInsights && (
                      <View style={styles.insightsSubTabIndicator} />
                    )}
                  </>
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
                const isSunday = new Date().getDay() === 0;
                const trendInsights = daysWithMeals >= 7 ? getMealTrendInsights(dataByDate, todayKey, userProfile) : [];
                
                if (daysWithMeals === 0) {
                  return (
                    <Text style={styles.insightsEmpty} selectable>
                      No meals logged in the past 7 days. Log meals on the Meals tab to see weekly insights.
                    </Text>
                  );
                }
                return (
                  <>
                    {/* Weekly Trends Section - Show whenever there's 7+ days of data, more prominent on Sundays */}
                    {daysWithMeals >= 7 && trendInsights.length > 0 && (
                      <View style={styles.insightsCard}>
                        <View style={styles.insightsCardTitleRow}>
                          <Image 
                            source={require("./assets/Trend.png")} 
                            style={styles.insightsTrendIcon}
                            resizeMode="contain"
                          />
                          <Text style={styles.insightsCardTitle} selectable>
                            {isSunday ? "Weekly Trends" : "Meal Patterns"}
                          </Text>
                        </View>
                        <Text style={styles.insightsCardSummary} selectable>
                          {isSunday 
                            ? "Here's what we noticed about your meal patterns this week:"
                            : "Here's what we noticed about your meal patterns over the past week:"}
                        </Text>
                        <View style={styles.insightsTips}>
                          <Text style={styles.insightsTipsTitle} selectable>MEAL-BY-MEAL INSIGHTS</Text>
                          <View style={styles.insightsTipsDivider} />
                          {trendInsights.map((t, i) => renderInsightTip(t, i, styles.insightsTipItem))}
                        </View>
                      </View>
                    )}
                    {/* Regular Weekly Insights */}
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
                  </>
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
            {(hasNewDayInsights || hasNewWeekInsights) && (
              <View style={styles.tabNewIndicator} />
            )}
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
  aiConsentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  aiConsentModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    paddingBottom: 28
  },
  aiConsentModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10
  },
  aiConsentModalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    marginBottom: 10
  },
  aiConsentPrimaryButton: {
    marginTop: 18,
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center"
  },
  aiConsentPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700"
  },
  aiConsentSecondaryButton: {
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF"
  },
  aiConsentSecondaryButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 10
  },
  aiConsentBlockedContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center"
  },
  aiConsentBlockedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14
  },
  aiConsentBlockedText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 10
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
  headerInsightsCenter: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  headerInsightsInfoButton: {
    position: "absolute",
    left: "50%",
    marginLeft: 46,
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  headerInsightsInfoButtonText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500"
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
    paddingHorizontal: 0,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8,
    zIndex: 1
  },
  sidebarScrollView: {
    flex: 1
  },
  sidebarScrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 12
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    paddingHorizontal: 12,
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
  menuToggleItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  subMenuToggleItem: {
    paddingLeft: 32,
    backgroundColor: "#F9FAFB"
  },
  smallSwitch: {
    transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }]
  },
  menuItemText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "400"
  },
  menuItemArrow: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 8
  },
  subMenuItem: {
    paddingLeft: 32,
    backgroundColor: "#F9FAFB"
  },
  subMenuItemText: {
    fontSize: 15,
    color: "#374151",
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
  mealInsightCardWrapper: {
    position: "relative",
    marginBottom: 16
  },
  mealInsightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "column",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  mealInsightHeart: {
    width: 24,
    height: 24,
    marginBottom: 12
  },
  mealInsightContent: {
    flex: 1
  },
  mealInsightText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 22,
    marginBottom: 8
  },
  mealInsightSuggestions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB"
  },
  mealInsightSuggestionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6
  },
  mealInsightSuggestionItem: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 4
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
    position: "relative",
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
    flex: 1,
    justifyContent: "center"
  },
  mealLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative"
  },
  mealLabel: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "400",
    lineHeight: 20
  },
  mealCalories: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
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
    justifyContent: "center",
    position: "relative"
  },
  tabLabelContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60
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
  tabNewIndicator: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
    top: -2,
    right: -2
  },
  analysisContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 12
  },
  sourcesScreenContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 12,
    gap: 10
  },
  sourcesNavRow: {
    marginTop: 14,
    paddingHorizontal: 2,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 3
  },
  sourcesNavText: {
    fontSize: 12,
    fontWeight: "400",
    fontStyle: "italic",
    color: "#6B7280"
  },
  sourcesNavChevron: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "400"
  },
  analysisSourcesCard: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  analysisSourcesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827"
  },
  analysisSourcesDisclaimer: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#4B5563"
  },
  analysisSourceLinkRow: {
    marginTop: 8
  },
  analysisSourceLinkText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#1D4ED8",
    textDecorationLine: "underline"
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
    borderRadius: 22,
    position: "relative"
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
  insightsSubTabIndicator: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
    top: 6,
    right: 6
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
  insightsCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14
  },
  insightsTrendIcon: {
    width: 24,
    height: 24,
    marginRight: 8
  },
  insightsCardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    flex: 1
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
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 20
  },
  insightsTipHeart: {
    width: 24,
    height: 24,
    marginBottom: 8
  },
  insightsTipTextWrap: {
    flex: 1,
    width: "100%"
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
  addCameraScreen: {
    flex: 1,
    backgroundColor: "#000000"
  },
  addCameraStage: {
    flex: 1,
    position: "relative"
  },
  addCameraImage: {
    width: "100%",
    height: "100%"
  },
  /** Shown while OFF lookup runs or after scan — camera is unmounted to avoid iOS FigCapture / XPC errors. */
  addBarcodeCameraPaused: {
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  addBarcodeCameraPausedText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 24
  },
  addCameraPlaceholder: {
    flex: 1,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center"
  },
  addCameraPlaceholderText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600"
  },
  addCameraPermissionButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB"
  },
  addCameraPermissionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600"
  },
  addCameraAnalyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  addCameraAnalyzingText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12
  },
  addShutterWrap: {
    position: "absolute",
    bottom: 112,
    left: 0,
    right: 0,
    alignItems: "center"
  },
  addShutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)"
  },
  addShutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF"
  },
  addGalleryButton: {
    position: "absolute",
    left: 86,
    bottom: 116,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.12)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  addGalleryButtonIcon: {
    width: 30,
    height: 30
  },
  addFloatingComposer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10
  },
  addKeyboardUnderlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -40,
    backgroundColor: "#F3F4F6"
  },
  addFloatingComposerExpanded: {
    minHeight: 420
  },
  /** Barcode card has grams field + estimate — needs more vertical space than text tab. */
  addFloatingComposerBarcode: {
    minHeight: 520,
    paddingBottom: 18
  },
  addFloatingTextContent: {
    flex: 1,
    minHeight: 0,
    marginTop: 10
  },
  addComposerTabsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 2
  },
  addComposerTab: {
    flex: 1,
    alignItems: "stretch",
    paddingVertical: 4
  },
  addComposerTabPill: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 5,
    minHeight: 76
  },
  addComposerTabPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  addComposerTabText: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.15,
    textAlign: "center"
  },
  addComposerTabTextActive: {
    color: "#1D4ED8",
    opacity: 1
  },
  addComposerProBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    zIndex: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#111827"
  },
  addBarcodeMvpContent: {
    flex: 1,
    minHeight: 0,
    marginTop: 10
  },
  addBarcodeMvpScrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  addBarcodeMvpCard: {
    flex: 1,
    minHeight: 200,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  addBarcodeMvpCardQuantity: {
    justifyContent: "flex-start",
    alignItems: "stretch",
    minHeight: 320
  },
  addBarcodeMvpStepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4
  },
  addBarcodeMvpProductCenter: {
    width: "100%",
    textAlign: "center"
  },
  addBarcodeMvpHint: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 2
  },
  addBarcodeMvpFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 6
  },
  addBarcodeMvpGramsInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    backgroundColor: "#F9FAFB"
  },
  addBarcodeMvpEstimate: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D4ED8",
    textAlign: "center",
    marginTop: 8
  },
  addBarcodeMvpTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827"
  },
  addBarcodeMvpBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
    textAlign: "center"
  },
  addBarcodeMvpBrand: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center"
  },
  addBarcodeMvpSource: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic"
  },
  addBarcodeMvpActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    width: "100%",
    justifyContent: "center"
  },
  addBarcodeMvpSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#E5E7EB"
  },
  addBarcodeMvpSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563"
  },
  addBarcodeMvpPrimary: {
    flex: 1,
    maxWidth: 220,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    alignItems: "center"
  },
  addBarcodeMvpPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  addComposerProBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  addFloatingInput: {
    marginTop: 0,
    flex: 1,
    minHeight: 260,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    color: "#111827",
    fontSize: 16
  },
  addFloatingActions: {
    flexDirection: "row",
    marginTop: 10,
    marginBottom: 0
  },
  addSuggestionsSlot: {
    height: 50,
    marginTop: 8,
    justifyContent: "center",
    overflow: "hidden"
  },
  addFloatingSuggestionsContainer: {
    marginTop: 0,
    flexWrap: "nowrap",
    alignItems: "center"
  },
  addFloatingCancel: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginRight: 10
  },
  addFloatingCancelText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600"
  },
  addFloatingConfirm: {
    flex: 1,
    backgroundColor: "#2563EB",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  addFloatingConfirmDisabled: {
    opacity: 0.55
  },
  addFloatingConfirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600"
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
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  addCardPhotoBackground: {
    ...StyleSheet.absoluteFillObject
  },
  addCardPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)"
  },
  addCardContent: {
    zIndex: 2
  },
  addPhotoActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  addPhotoButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  addPhotoButtonDisabled: {
    opacity: 0.65
  },
  addPhotoButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600"
  },
  addPhotoClearButton: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  addPhotoClearButtonText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600"
  },
  addPhotoProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  addPhotoProgressText: {
    marginLeft: 8,
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600"
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
  addInputForeground: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 12,
    padding: 10
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
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24
  },
  emptyStateImage: {
    width: 200,
    height: 200,
    marginBottom: 12
  },
  emptyStateText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22
  },
  emptyStateButton: {
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 160
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
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
  onboardingContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
    justifyContent: "space-between"
  },
  onboardingTitle: {
    fontSize: 24,
    lineHeight: 34,
    textAlign: "center",
    color: "#111827",
    fontWeight: "800"
  },
  onboardingSubtitle: {
    marginTop: 20,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    color: "#111827"
  },
  onboardingSubtitleSmall: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 16,
    textAlign: "center",
    color: "#111827"
  },
  onboardingList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB"
  },
  onboardingListRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  onboardingListText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500"
  },
  onboardingListCheck: {
    fontSize: 26,
    color: "#111827",
    width: 28,
    textAlign: "center"
  },
  onboardingFootnote: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 13,
    color: "#111827",
    fontStyle: "italic"
  },
  onboardingBackLink: {
    marginTop: 10,
    alignItems: "center"
  },
  onboardingBackLinkText: {
    fontSize: 14,
    color: "#1885E8",
    fontWeight: "500"
  },
  primaryButton: {
    backgroundColor: "#1885E8",
    borderRadius: 999,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20
  },
  primaryButtonDisabled: {
    opacity: 0.5
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600"
  },
  onboardingFieldRow: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  onboardingFieldLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500"
  },
  onboardingDobLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  onboardingAgeText: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    fontWeight: "300"
  },
  onboardingFieldInput: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    minWidth: 116,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  onboardingFieldInputText: {
    color: "#111827",
    fontSize: 14
  },
  onboardingFieldInputSmall: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    minWidth: 70,
    textAlign: "right",
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#111827",
    fontSize: 14
  },
  inlineToggleRow: {
    flexDirection: "row",
    gap: 8
  },
  inlineTogglePill: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  inlineTogglePillActive: {
    backgroundColor: "#D1E7FF"
  },
  inlineToggleText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "500"
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  onboardingUnitText: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827"
  },
  onboardingSummaryRow: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  onboardingValuePill: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    minWidth: 74,
    textAlign: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#111827",
    fontSize: 14,
    fontWeight: "500"
  },
  onboardingValueInput: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    minWidth: 74,
    textAlign: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#111827",
    fontSize: 14,
    fontWeight: "500"
  },
  onboardingDobModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "90%",
    maxWidth: 420,
    paddingTop: 10,
    paddingBottom: 6
  },
  onboardingDobModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4
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
  personalSectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5
  },
  personalSectionTitleSpaced: {
    marginTop: 28
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
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  fieldLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500"
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  fieldMetaText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400"
  },
  fieldValue: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 116,
    alignItems: "center",
    justifyContent: "center"
  },
  fieldValueInput: {
    textAlign: "center",
    color: "#111827",
    fontSize: 14,
    fontWeight: "500"
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
  subscriptionRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  subscriptionStatusText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "400"
  },
  subscriptionPill: {
    minWidth: 74,
    paddingHorizontal: 12
  },
  upgradeInlineButton: {
    backgroundColor: "#1885E8",
    borderRadius: 999,
    minHeight: 34,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  upgradeInlineButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600"
  },
  heightInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  heightInput: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 88,
    fontSize: 14,
    color: "#111827",
    textAlign: "center"
  },
  unitDropdown: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
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
  foodDetailQuantityRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 8
  },
  foodDetailQuantityInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#111827"
  },
  foodDetailUnitInput: {
    minWidth: 80,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#111827"
  },
  foodDetailUnitButton: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  foodDetailUnitButtonText: {
    fontSize: 16,
    color: "#111827"
  },
  foodDetailUnitButtonChevron: {
    marginLeft: 10,
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600"
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
  newUserPaywallOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  newUserPaywallContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    position: "relative"
  },
  newUserPaywallCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1
  },
  newUserPaywallCloseText: {
    fontSize: 18,
    color: "#6B7280",
    fontWeight: "600"
  },
  newUserPaywallBody: {
    padding: 32,
    paddingTop: 48,
    alignItems: "center"
  },
  newUserPaywallTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12
  },
  newUserPaywallSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32
  },
  newUserPaywallUpgradeButton: {
    backgroundColor: "#4263EB",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center"
  },
  newUserPaywallUpgradeButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF"
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
