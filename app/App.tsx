import React, { useState } from "react";
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
  Keyboard
} from "react-native";
import { SvgXml } from "react-native-svg";
import {
  afternoonSnackIcon,
  breakfastIcon,
  dinnerIcon,
  eveningSnackIcon,
  lunchIcon
} from "./mealIcons";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000/v1";

type NutrientTotals = {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
  fat_g: 0
});

const sumTotals = (a: NutrientTotals, b: NutrientTotals): NutrientTotals => ({
  calories_kcal: a.calories_kcal + b.calories_kcal,
  protein_g: a.protein_g + b.protein_g,
  carbs_g: a.carbs_g + b.carbs_g,
  fat_g: a.fat_g + b.fat_g
});

const subtractTotals = (
  a: NutrientTotals,
  b: NutrientTotals
): NutrientTotals => ({
  calories_kcal: a.calories_kcal - b.calories_kcal,
  protein_g: a.protein_g - b.protein_g,
  carbs_g: a.carbs_g - b.carbs_g,
  fat_g: a.fat_g - b.fat_g
});

const round = (value: number) => Math.round(value * 10) / 10;
const stripParenthetical = (value: string) => value.replace(/\s*\([^)]*\)\s*/g, " ").trim();

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

const initialMeals: MealState[] = [
  { id: "breakfast", label: "Breakfast", nutrients: emptyTotals() },
  { id: "lunch", label: "Lunch", nutrients: emptyTotals() },
  { id: "snack-afternoon", label: "Afternoon Snack", nutrients: emptyTotals() },
  { id: "dinner", label: "Dinner", nutrients: emptyTotals() },
  { id: "snack-evening", label: "Evening Snack", nutrients: emptyTotals() }
];

const mealIconById: Record<string, string> = {
  breakfast: breakfastIcon,
  lunch: lunchIcon,
  "snack-afternoon": afternoonSnackIcon,
  dinner: dinnerIcon,
  "snack-evening": eveningSnackIcon
};

type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  nutrients: NutrientTotals;
};

export default function App() {
  const [view, setView] = useState<"home" | "add" | "meal">("home");
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [entryText, setEntryText] = useState("");
  const [meals, setMeals] = useState<MealState[]>(initialMeals);
  const [mealItems, setMealItems] = useState<Record<string, MealItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          startedAt: new Date().toISOString(),
          tzOffsetMinutes: new Date().getTimezoneOffset()
        })
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || "Failed to log meal.");
      }
      const data = (await res.json()) as MealResponse;
      setMeals((prev) =>
        prev.map((meal) =>
          meal.id === selectedMealId
            ? {
                ...meal,
                nutrients: sumTotals(meal.nutrients, data.nutrients)
              }
            : meal
        )
      );
      setMealItems((prev) => ({
        ...prev,
        [selectedMealId]: [...(prev[selectedMealId] || []), ...data.items]
      }));
      setEntryText("");
      setView("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (mealId: string, itemId: string) => {
    setMealItems((prev) => {
      const items = prev[mealId] || [];
      const itemToRemove = items.find((item) => item.id === itemId);
      if (!itemToRemove) return prev;
      const updatedItems = items.filter((item) => item.id !== itemId);
      setMeals((prevMeals) =>
        prevMeals.map((meal) =>
          meal.id === mealId
            ? {
                ...meal,
                nutrients: subtractTotals(meal.nutrients, itemToRemove.nutrients)
              }
            : meal
        )
      );
      return { ...prev, [mealId]: updatedItems };
    });
  };

  const selectedMealLabel =
    meals.find((meal) => meal.id === selectedMealId)?.label || "";
  const selectedItems =
    (selectedMealId && mealItems[selectedMealId]) || [];
  const totals = meals.reduce((acc, meal) => sumTotals(acc, meal.nutrients), emptyTotals());

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
            <View style={styles.iconButton} />
          </View>

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
            />
          </View>

          <TouchableOpacity
            style={[styles.addSubmit, loading && styles.addSubmitDisabled]}
            onPress={handleAdd}
            disabled={loading}
          >
            <Text
              style={[
                styles.addSubmitText,
                loading && styles.addSubmitTextDisabled
              ]}
            >
              {loading ? "Adding..." : "Add"}
            </Text>
          </TouchableOpacity>

          {error ? <Text style={styles.addError}>{error}</Text> : null}
          {selectedMealLabel ? (
            <Text style={styles.addFooter}>Adding to {selectedMealLabel}</Text>
          ) : null}
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
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeaderRow}>
                <View style={styles.itemHeaderText}>
                  <Text
                    style={styles.itemTitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {stripParenthetical(item.name)}
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
                  onPress={() => handleDeleteItem(selectedMealId, item.id)}
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
            </View>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Today</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconText}>›</Text>
        </TouchableOpacity>
      </View>

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
                    ? `${round(totals.protein_g)}g`
                    : item.label === "Carbs"
                      ? `${round(totals.carbs_g)}g`
                      : `${round(totals.fat_g)}g`}
              </Text>
              <Text style={styles.nutritionTarget}>{item.target}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacing]}>MEALS</Text>
        <View style={styles.mealsList}>
          {meals.map((meal) => (
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
                <SvgXml
                  xml={mealIconById[meal.id] || breakfastIcon}
                  width={24}
                  height={24}
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
          ))}
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        <View style={[styles.tabItem, styles.tabItemActive]}>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>MEALS</Text>
        </View>
        <View style={styles.tabItem}>
          <Text style={styles.tabLabel}>ANALYSIS</Text>
        </View>
        <View style={styles.tabItem}>
          <Text style={styles.tabLabel}>INSIGHTS</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    paddingTop: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 28
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937"
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  iconText: {
    fontSize: 20,
    color: "#1F2937"
  },
  content: {
    paddingBottom: 100,
    paddingHorizontal: 28
  },
  mealDetailContent: {
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    marginBottom: 18
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
  mealDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 28
  },
  mealDetailTitle: {
    fontSize: 20,
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
    fontSize: 18,
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
    gap: 8
  },
  macroPill: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999
  },
  macroText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600"
  },
  itemCalories: {
    marginLeft: "auto",
    color: "#111827",
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
  }
});
