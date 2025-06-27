import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FilterAsset } from '../../types/media';
import { FILTER_LIBRARY } from '../../constants/filters';
import { gradients } from '../../styles/gradients';

const { width: screenWidth } = Dimensions.get('window');

interface FilterSelectorProps {
  activeFilter: FilterAsset;
  onFilterSelect: (filter: FilterAsset) => void;
  visible: boolean;
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  activeFilter,
  onFilterSelect,
  visible,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={20} style={styles.blurContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {FILTER_LIBRARY.map((filter) => (
            <FilterButton
              key={filter.id}
              filter={filter}
              isActive={activeFilter.id === filter.id}
              onPress={() => onFilterSelect(filter)}
            />
          ))}
        </ScrollView>
      </BlurView>
    </View>
  );
};

interface FilterButtonProps {
  filter: FilterAsset;
  isActive: boolean;
  onPress: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  filter,
  isActive,
  onPress,
}) => {
  return (
    <Pressable style={styles.filterButton} onPress={onPress}>
      <View style={[styles.filterButtonInner, isActive && styles.activeFilter]}>
        {isActive && (
          <LinearGradient
            colors={gradients.primary}
            style={styles.activeGradient}
          />
        )}
        
        <View style={styles.filterContent}>
          {filter.id === 'none' ? (
            <View style={styles.noFilterIcon}>
              <Text style={styles.noFilterText}>×</Text>
            </View>
          ) : (
            <Text style={styles.filterThumbnail}>{filter.thumbnail}</Text>
          )}
        </View>
        
        <Text style={[styles.filterName, isActive && styles.activeFilterName]}>
          {filter.name}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 140, // Above the capture button
    left: 0,
    right: 0,
    height: 100,
  },
  blurContainer: {
    flex: 1,
    paddingVertical: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterButton: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  filterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  activeFilter: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
  },
  activeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  filterContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  filterThumbnail: {
    fontSize: 24,
    textAlign: 'center',
  },
  noFilterIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noFilterText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  filterName: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    maxWidth: 70,
  },
  activeFilterName: {
    color: '#fff',
    fontWeight: '600',
  },
});