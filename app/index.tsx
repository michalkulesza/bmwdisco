import { StyleSheet, Text, View } from 'react-native';

const HomeScreen = () => (
  <View style={styles.container}>
    <Text>BMW Lights</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default HomeScreen;
