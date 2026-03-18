const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function checkStorage() {
  try {
    const data = await AsyncStorage.getItem('@mealtracking_dataByDate');
    const profile = await AsyncStorage.getItem('@mealtracking_userProfile');
    console.log('Data exists:', !!data);
    console.log('Profile exists:', !!profile);
    if (data) {
      const parsed = JSON.parse(data);
      console.log('Days of data:', Object.keys(parsed).length);
      console.log('Dates:', Object.keys(parsed).slice(0, 10));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkStorage();
