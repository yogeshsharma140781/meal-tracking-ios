import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
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
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

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

type UserProfile = {
  sex: "male" | "female";
  age: number;
  weightKg: number;
  goal: "reduce_cholesterol_maintain_weight";
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

/** Fixed spacing between top header and content on all screens */
const HEADER_TO_CONTENT_GAP = 24;

const defaultProfile: UserProfile = {
  sex: "male",
  age: 44,
  weightKg: 73,
  goal: "reduce_cholesterol_maintain_weight"
};

const getMacroTargets = (profile: UserProfile) => {
  if (profile.sex === "male" && profile.age === 44 && profile.weightKg === 73) {
    return {
      calories_kcal: 2600,
      protein_g: 90,
      carbs_g: 100,
      fat_g: 85
    };
  }

  return {
    calories_kcal: 2400,
    protein_g: 80,
    carbs_g: 100,
    fat_g: 80
  };
};

const macroTargets = getMacroTargets(defaultProfile);

const nutritionSummary = [
  { label: "Calories", target: `(${macroTargets.calories_kcal})` },
  { label: "Proteins", target: `(${macroTargets.protein_g}g)` },
  { label: "Carbs", target: `(${macroTargets.carbs_g}g)` },
  { label: "Fats", target: `(${macroTargets.fat_g}g)` }
];

const STORAGE_KEY = "@mealtracking_dataByDate";

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

const ANALYSIS_MACROS = [
  { key: "protein_g" as const, label: "Protein", unit: "g", target: macroTargets.protein_g },
  { key: "carbs_g" as const, label: "Carbs", unit: "g", target: macroTargets.carbs_g },
  { key: "fat_g" as const, label: "Fat", unit: "g", target: macroTargets.fat_g }
];

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

export default function App() {
  const [view, setView] = useState<"home" | "add" | "meal" | "export">("home");
  const [activeTab, setActiveTab] = useState<TabId>("meals");
  const [selectedNutrient, setSelectedNutrient] = useState<SelectedNutrient | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [selectedFoodItem, setSelectedFoodItem] = useState<MealItem | null>(null);
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
  const [exportRange, setExportRange] = useState<"7" | "30" | "custom">("7");
  const [exportStartDate, setExportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateKey(d);
  });
  const [exportEndDate, setExportEndDate] = useState<string>(() => toDateKey(new Date()));

  const todayKey = toDateKey(new Date());

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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
  }, []);

  // Loading screen image is loaded via require() - no need for async loading

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();
    const MIN_LOADING_TIME = 1500; // Minimum 1.5 seconds to show loading screen
    
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        const parsed = raw ? JSON.parse(raw) : {};
        if (typeof parsed === "object" && parsed !== null) {
          const migrated = migrateDataForVitamins(parsed);
          if (migrated !== parsed) {
            // Save migrated data back
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
          if (!cancelled) setDataByDate(migrated);
        }
      } catch (_) {}
      
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

  const meals = getDayData(selectedDate).meals;
  const mealItems = getDayData(selectedDate).mealItems;
  const totals = meals.reduce((acc, meal) => sumTotals(acc, meal.nutrients), emptyTotals());
  const microTotals = getMicroTotalsFromItems(mealItems);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;

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

  const fetchFoodInsights = useCallback(async (item: MealItem) => {
    try {
      setLoadingInsights(true);
      const url = `${API_BASE_URL}/meals/food-insights`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: item.name,
          nutrients: item.nutrients,
          quantity: item.quantity,
          unit: item.unit,
          grams: item.grams
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
  }, []);

  useEffect(() => {
    if (selectedFoodItem) {
      fetchFoodInsights(selectedFoodItem);
    } else {
      setFoodInsights(null);
    }
  }, [selectedFoodItem, fetchFoodInsights]);

  const openAdd = (mealId: string) => {
    setSelectedMealId(mealId);
    setError(null);
    setView("add");
  };

  const handleAdd = async () => {
    if (!selectedMealId || !entryText.trim()) return;
    try {
      Keyboard.dismiss();
      setLoading(true);
      setError(null);
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
        const payload = await res.json();
        throw new Error(payload?.error || "Failed to log meal.");
      }
      const data = (await res.json()) as MealResponse & { items?: MealItem[] };
      const day = getDayData(selectedDate);
      const nextMeals = day.meals.map((meal) =>
        meal.id === selectedMealId
          ? { ...meal, nutrients: sumTotals(meal.nutrients, data.nutrients) }
          : meal
      );
      const nextItems = {
        ...day.mealItems,
        [selectedMealId]: [...(day.mealItems[selectedMealId] || []), ...(data.items || [])]
      };
      const next = { ...dataByDate, [selectedDate]: { meals: nextMeals, mealItems: nextItems } };
      setDataByDate(next);
      await persistData(next);
      setEntryText("");
      setView("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
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

  if (view === "add") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.addScreen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.addHeader}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setView("home")}
            >
              <Text style={styles.iconText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add item(s)</Text>
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
          </View>

          <ScrollView
            style={styles.addScroll}
            contentContainerStyle={styles.addScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
          >
            <View style={styles.addCard}>
              <Text style={styles.addHint}>
                Describe the food items and we will do the rest
              </Text>
              <TextInput
                value={entryText}
                onChangeText={setEntryText}
                placeholder=""
                style={styles.addInput}
                multiline
                textAlignVertical="top"
                editable
                autoFocus
                scrollEnabled={false}
              />
            </View>

            <TouchableOpacity
              style={styles.hideKeyboardButton}
              onPress={() => Keyboard.dismiss()}
            >
              <Text style={styles.hideKeyboardText}>Hide keyboard</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.addError}>{error}</Text> : null}
            {selectedMealLabel ? (
              <Text style={styles.addFooter}>Adding to {selectedMealLabel}</Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (view === "meal" && selectedMealId) {
    const totalCalories = Math.round(
      selectedItems.reduce((sum, item) => sum + item.nutrients.calories_kcal, 0)
    );
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.mealDetailContent}>
          <View style={styles.mealDetailHeader}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setView("home")}
            >
              <Text style={styles.iconText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.mealDetailTitle}>{selectedMealLabel}</Text>
            <View style={styles.iconButton} />
          </View>

          {selectedItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              onPress={() => setSelectedFoodItem(item)}
            >
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
                <TouchableOpacity
                  style={styles.itemRemove}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(selectedMealId, item.id);
                  }}
                >
                  <Text style={styles.itemRemoveText}>×</Text>
                </TouchableOpacity>
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
            </TouchableOpacity>
          ))}

          {selectedItems.length === 0 && (
            <Text style={styles.emptyText}>No items logged yet.</Text>
          )}

          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={() => setView("add")}
          >
            <Text style={styles.addMoreText}>+ Add more</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.doneButton} onPress={() => setView("home")}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
                  <tr><td>Fiber</td><td>${Math.round(microTotals.fiber_g * 10) / 10}g</td></tr>
                  <tr><td>Vitamin C</td><td>${Math.round(microTotals.vitamin_c_mg * 10) / 10}mg</td></tr>
                  <tr><td>Vitamin A</td><td>${Math.round(microTotals.vitamin_a_mcg * 10) / 10}mcg</td></tr>
                  <tr><td>Omega 3</td><td>${Math.round(microTotals.omega_3_g * 1000 * 10) / 10}mg</td></tr>
                  <tr><td>Cholesterol</td><td>${Math.round(microTotals.cholesterol_mg * 10) / 10}mg</td></tr>
                  <tr><td>Vitamin D</td><td>${Math.round(microTotals.vitamin_d_iu * 10) / 10}IU</td></tr>
                  <tr><td>Magnesium</td><td>${Math.round(microTotals.magnesium_mg * 10) / 10}mg</td></tr>
                  <tr><td>Sodium</td><td>${Math.round(microTotals.sodium_mg * 10) / 10}mg</td></tr>
                  <tr><td>Potassium</td><td>${Math.round(microTotals.potassium_mg * 10) / 10}mg</td></tr>
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
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
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
        </View>
        <View style={styles.iconButton} />
      </View>

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                // TODO: Navigate to Personal details screen
              }}
            >
              <Text style={styles.menuItemText}>Personal details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setView("export");
              }}
            >
              <Text style={styles.menuItemText}>Export</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.mealsSwipeArea} {...mealsSwipeResponder.panHandlers}>
        {activeTab === "meals" && (
          <Animated.View
            style={[
              { flex: 1 },
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionLabel}>NUTRITION</Text>
            <View style={styles.nutritionCard}>
              {nutritionSummary.map((item) => (
                <View key={item.label} style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>{item.label}</Text>
                  <Text style={styles.nutritionValue}>
                    {item.label === "Calories"
                      ? Math.round(totals.calories_kcal)
                      : item.label === "Proteins"
                        ? `${Math.round(totals.protein_g)}g`
                        : item.label === "Carbs"
                          ? `${Math.round(totals.carbs_g)}g`
                          : `${Math.round(totals.fat_g)}g`}
                  </Text>
                  <Text style={styles.nutritionTarget}>{item.target}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionLabel, styles.sectionSpacing]}>MEALS</Text>
            <View style={styles.mealsList}>
              {meals.map((meal) => {
                const mealItemsForMeal = mealItems[meal.id] || [];
                const hasItems = mealItemsForMeal.length > 0 || meal.nutrients.calories_kcal > 0;
                const iconSource = hasItems ? MEAL_ICON_COLORED : MEAL_ICON_GRAYSCALE;
                const iconSize = meal.id === "snack-afternoon" || meal.id === "snack-evening" ? 36 : 40;
                
                return (
                <TouchableOpacity
                  key={meal.id}
                  style={styles.mealCard}
                  onPress={() => {
                    setSelectedMealId(meal.id);
                    setView("meal");
                  }}
                  activeOpacity={0.9}
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
                  </View>
                  <TouchableOpacity
                    style={styles.addCircle}
                    onPress={() => openAdd(meal.id)}
                  >
                    <Text style={styles.addCircleText}>Add</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          </Animated.View>
        )}

        {activeTab === "analysis" &&
          selectedNutrient === null && (
            <ScrollView
              contentContainerStyle={styles.analysisContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.sectionLabel}>NUTRIENTS</Text>
              <View style={styles.analysisMacroList}>
                {ANALYSIS_MACROS.map(({ key, label, unit, target }) => {
                  const current = totals[key];
                  const progress = target > 0 ? Math.min(1, current / target) : 0;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.analysisMacroCard}
                      onPress={() =>
                        setSelectedNutrient({
                          type: "macro",
                          key,
                          label,
                          unit,
                          target
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.analysisMacroName}>{label}</Text>
                      <View style={styles.analysisMacroBarTrack}>
                        <View
                          style={[
                            styles.analysisMacroBarFill,
                            { width: `${progress * 100}%` }
                          ]}
                        />
                      </View>
                      <Text style={styles.analysisMacroValues}>
                        <Text style={styles.analysisMacroCurrent}>
                          {Math.round(current)}
                          {unit}
                        </Text>
                        <Text style={styles.analysisMacroTarget}>
                          {" "}
                          / {target}
                          {unit}
                        </Text>
                      </Text>
                      <Text style={styles.analysisMacroArrow}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
                MICRO-NUTRIENTS
              </Text>
              <View style={styles.analysisMicroGrid}>
                {ANALYSIS_MICROS.map(({ label, unit, target, key }) => {
                  const current = key ? (microTotals[key] ?? 0) : 0;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={styles.analysisMicroCard}
                      onPress={() =>
                        setSelectedNutrient({
                          type: "micro",
                          label,
                          unit,
                          target,
                          ...(key ? { key } : {})
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.analysisMicroName}>{label}</Text>
                      <View style={styles.analysisMicroValues}>
                        <Text style={styles.analysisMicroCurrent}>
                          {key ? Math.round(current) : current}
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
            </ScrollView>
          )}

        {activeTab === "analysis" && selectedNutrient !== null && (
          <ScrollView
            contentContainerStyle={styles.nutrientDetailContent}
            showsVerticalScrollIndicator
          >
            <View style={styles.nutrientDetailHeader}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setSelectedNutrient(null)}
              >
                <Text style={styles.iconText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.nutrientDetailTitle}>
                {selectedNutrient.label.toUpperCase()}
              </Text>
              <View style={styles.iconButton} />
            </View>

            <Text style={styles.nutrientDetailExplanation}>
              {NUTRIENT_EXPLANATIONS[selectedNutrient.label] ??
                `${selectedNutrient.label} supports overall health; target is based on general guidelines.`}
            </Text>

            {(() => {
              const current =
                selectedNutrient.type === "macro"
                  ? totals[selectedNutrient.key]
                  : selectedNutrient.type === "micro" && selectedNutrient.key
                    ? (microTotals[selectedNutrient.key] ?? 0)
                    : 0;
              const { target, unit } = selectedNutrient;
              const pct =
                target > 0 ? Math.round((current / target) * 100) : 0;
              return (
                <Text style={styles.nutrientDetailProgress}>
                  {Math.round(current)}
                  {unit} today ({pct}% of your goal)
                </Text>
              );
            })()}

            <Text style={styles.nutrientDetailContributorsLabel}>
              Contributors
            </Text>
            {(() => {
              const contributors = getContributors(
                selectedNutrient,
                mealItems,
                totals
              );
              if (contributors.length === 0) {
                return (
                  <Text style={styles.nutrientDetailEmpty}>
                    No logged foods contribute to this nutrient yet.
                  </Text>
                );
              }
              return (
                <View style={styles.nutrientDetailContributors}>
                  {contributors.map(({ name, amount }, idx) => (
                    <View
                      key={name + String(amount)}
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
                        {Math.round(amount)}
                        {selectedNutrient.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </ScrollView>
        )}

        {selectedFoodItem !== null && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.foodDetailContent}
            showsVerticalScrollIndicator
          >
            <View style={styles.foodDetailHeader}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setSelectedFoodItem(null)}
              >
                <Text style={styles.iconText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.foodDetailTitle}>
                {capitalizeFirst(stripParenthetical(selectedFoodItem.name)).toUpperCase()}
              </Text>
              <View style={styles.iconButton} />
            </View>

            <View style={styles.foodDetailSection}>
              <Text style={styles.foodDetailSectionTitle}>Nutrition Facts</Text>
              <View style={styles.foodDetailMacros}>
                <View style={styles.foodDetailMacroCard}>
                  <Text style={styles.foodDetailMacroValue}>
                    {Math.round(selectedFoodItem.nutrients.calories_kcal)}
                  </Text>
                  <Text style={styles.foodDetailMacroLabel}>Calories</Text>
                </View>
                <View style={styles.foodDetailMacroCard}>
                  <Text style={styles.foodDetailMacroValue}>
                    {Math.round(selectedFoodItem.nutrients.protein_g)}g
                  </Text>
                  <Text style={styles.foodDetailMacroLabel}>Protein</Text>
                </View>
                <View style={styles.foodDetailMacroCard}>
                  <Text style={styles.foodDetailMacroValue}>
                    {Math.round(selectedFoodItem.nutrients.carbs_g)}g
                  </Text>
                  <Text style={styles.foodDetailMacroLabel}>Carbs</Text>
                </View>
                <View style={styles.foodDetailMacroCard}>
                  <Text style={styles.foodDetailMacroValue}>
                    {Math.round(selectedFoodItem.nutrients.fat_g)}g
                  </Text>
                  <Text style={styles.foodDetailMacroLabel}>Fat</Text>
                </View>
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
                {foodInsights.healthQuotient > 0 && (
                  <View style={styles.foodDetailSection}>
                    <Text style={styles.foodDetailSectionTitle}>Health Quotient</Text>
                    <View style={styles.foodDetailHealthQuotient}>
                      <Text style={styles.foodDetailHealthQuotientValue}>
                        {foodInsights.healthQuotient}/100
                      </Text>
                      <View style={styles.foodDetailHealthQuotientBar}>
                        <View
                          style={[
                            styles.foodDetailHealthQuotientFill,
                            {
                              width: `${foodInsights.healthQuotient}%`,
                              backgroundColor:
                                foodInsights.healthQuotient >= 80
                                  ? "#4CAF50"
                                  : foodInsights.healthQuotient >= 60
                                    ? "#FFC107"
                                    : "#FF5722"
                            }
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {foodInsights.insights && (
                  <View style={styles.foodDetailSection}>
                    <Text style={styles.foodDetailSectionTitle}>Insights</Text>
                    <Text style={styles.foodDetailInsights}>{foodInsights.insights}</Text>
                  </View>
                )}

                {foodInsights.tips && foodInsights.tips.length > 0 && (
                  <View style={styles.foodDetailSection}>
                    <Text style={styles.foodDetailSectionTitle}>Tips</Text>
                    {foodInsights.tips.map((tip, idx) => (
                      <View key={idx} style={styles.foodDetailTip}>
                        <Text style={styles.foodDetailTipBullet}>•</Text>
                        <Text style={styles.foodDetailTipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        )}

        {activeTab === "insights" && (
          <View style={styles.insightsPlaceholder}>
            <Text style={styles.insightsPlaceholderText}>Insights coming soon.</Text>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "meals" && styles.tabItemActive]}
          onPress={() => setActiveTab("meals")}
        >
          <Text
            style={[styles.tabLabel, activeTab === "meals" && styles.tabLabelActive]}
          >
            MEALS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "analysis" && styles.tabItemActive]}
          onPress={() => setActiveTab("analysis")}
        >
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
          style={[styles.tabItem, activeTab === "insights" && styles.tabItemActive]}
          onPress={() => setActiveTab("insights")}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === "insights" && styles.tabLabelActive
            ]}
          >
            INSIGHTS
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    paddingTop: 24
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    width: "100%",
    height: "100%"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: HEADER_TO_CONTENT_GAP,
    paddingHorizontal: 28
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
    fontWeight: "600"
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    paddingTop: 60,
    paddingLeft: 28
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 100,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  menuItemText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500"
  },
  mealsSwipeArea: {
    flex: 1
  },
  content: {
    paddingTop: 8,
    paddingBottom: 100,
    paddingHorizontal: 28
  },
  mealDetailContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 28
  },
  sectionLabel: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 10
  },
  sectionSpacing: {
    marginTop: 24
  },
  nutritionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1
  },
  nutritionLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 6
  },
  nutritionValue: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16
  },
  nutritionTarget: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 4
  },
  mealsList: {
    gap: 12
  },
  mealCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
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
    fontWeight: "600"
  },
  mealCalories: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4
  },
  addCircle: {
    minWidth: 62,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  addCircleText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600"
  },
  tabBar: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 16,
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
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 22
  },
  tabItemActive: {
    backgroundColor: "#E0E7FF"
  },
  tabLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700"
  },
  tabLabelActive: {
    color: "#1D4ED8"
  },
  analysisContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 28
  },
  analysisMacroList: {
    gap: 12
  },
  analysisMacroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  analysisMacroName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    width: 72
  },
  analysisMacroBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
    overflow: "hidden"
  },
  analysisMacroBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#2563EB"
  },
  analysisMacroValues: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 8
  },
  analysisMacroCurrent: {
    fontWeight: "600",
    color: "#111827"
  },
  analysisMacroTarget: {
    fontWeight: "400",
    color: "#9CA3AF"
  },
  analysisMacroArrow: {
    fontSize: 16,
    color: "#9CA3AF"
  },
  analysisMicroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 0
  },
  analysisMicroCard: {
    width: "31%",
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
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
  insightsPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28
  },
  insightsPlaceholderText: {
    fontSize: 16,
    color: "#9CA3AF"
  },
  nutrientDetailContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 28
  },
  nutrientDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: HEADER_TO_CONTENT_GAP,
    paddingHorizontal: 0
  },
  nutrientDetailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    letterSpacing: 0.5
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
  nutrientDetailContributorsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12
  },
  nutrientDetailEmpty: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic"
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 28,
    paddingTop: 16,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  addHeaderButtonText: {
    color: "#2563EB",
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
  addSubmit: {
    marginTop: 24,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 48,
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
    color: "#6B7280"
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
  hideKeyboardButton: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  hideKeyboardText: {
    color: "#6B7280",
    fontSize: 14
  },
  mealDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: HEADER_TO_CONTENT_GAP,
    paddingHorizontal: 28
  },
  mealDetailTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937"
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 0,
    marginBottom: 14,
    width: "100%",
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
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
  itemRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center"
  },
  itemRemoveText: {
    color: "#6B7280",
    fontSize: 18
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
    paddingHorizontal: 6,
    borderRadius: 999
  },
  macroText: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "600"
  },
  itemCalories: {
    marginLeft: "auto",
    color: "#111827",
    fontSize: 11,
    fontWeight: "600"
  },
  doneButton: {
    marginHorizontal: 28,
    marginBottom: 24,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 80,
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
  addMoreButton: {
    alignSelf: "center",
    marginTop: 12,
    backgroundColor: "#5B5CE9",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 40
  },
  addMoreText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600"
  },
  emptyText: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 24
  },
  exportContent: {
    paddingTop: 8,
    paddingBottom: 100,
    paddingHorizontal: 28
  },
  exportOption: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600"
  },
  foodDetailContent: {
    paddingTop: 8,
    paddingBottom: 120,
    paddingHorizontal: 28
  },
  foodDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: HEADER_TO_CONTENT_GAP,
    paddingHorizontal: 0
  },
  foodDetailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    letterSpacing: 0.5
  },
  foodDetailSection: {
    marginBottom: 32
  },
  foodDetailSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 16,
    letterSpacing: 0.5
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
    alignItems: "center",
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
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500"
  },
  foodDetailMicros: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  foodDetailMicroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center"
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
