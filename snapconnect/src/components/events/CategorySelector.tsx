import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { useEventStore } from '../../stores/eventStore';
import { EventCategory } from '../../services/eventService';

interface CategorySelectorProps {
  onCategorySelect?: (category: EventCategory) => void;
  className?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  onCategorySelect,
  className = '',
}) => {
  const {
    categories,
    formData,
    updateFormData,
    loadCategories,
    isLoading,
  } = useEventStore();

  useEffect(() => {
    if (categories.length === 0) {
      loadCategories();
    }
  }, []);

  const handleCategorySelect = (category: EventCategory) => {
    updateFormData({ category_id: category.id });
    
    if (onCategorySelect) {
      onCategorySelect(category);
    }
  };

  const getGradientForCategory = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    
    switch (name) {
      case 'workout':
      case 'strength':
        return 'strength';
      case 'running':
      case 'cardio':
        return 'cardio';
      case 'yoga':
      case 'flexibility':
        return 'flexibility';
      case 'cycling':
        return 'primary';
      case 'swimming':
        return 'recovery';
      case 'sports':
        return 'danger';
      case 'hiking':
        return 'success';
      case 'dance':
        return 'secondary';
      case 'martial arts':
        return 'dark';
      default:
        return 'light';
    }
  };

  const selectedCategory = categories.find(cat => cat.id === formData.category_id);

  if (isLoading) {
    return (
      <View className={className}>
        <Text className="text-white text-lg font-semibold mb-3">Category</Text>
        <GlassCard>
          <Text className="text-white/70 text-center">Loading categories...</Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <View className={className}>
      <Text className="text-white text-lg font-semibold mb-3">Category</Text>
      
      {/* Selected Category Display */}
      {selectedCategory && (
        <GlassCard className="mb-4">
          <View className="flex-row items-center">
            <Text className="text-2xl mr-3">
              {selectedCategory.icon || '📅'}
            </Text>
            <View className="flex-1">
              <Text className="text-white font-semibold">
                {selectedCategory.name}
              </Text>
              {selectedCategory.description && (
                <Text className="text-white/70 text-sm">
                  {selectedCategory.description}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => updateFormData({ category_id: '' })}
              className="ml-3"
            >
              <Text className="text-white/70 text-lg">✕</Text>
            </Pressable>
          </View>
        </GlassCard>
      )}

      {/* Category Grid */}
      {!selectedCategory && (
        <View className="mb-4">
          <View className="flex-row flex-wrap gap-3">
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => handleCategorySelect(category)}
                className="w-20"
              >
                <GlassCard className="items-center py-3">
                  <Text className="text-2xl mb-1">
                    {category.icon || '📅'}
                  </Text>
                  <Text className="text-white text-xs font-medium text-center">
                    {category.name}
                  </Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Show remaining categories if many exist */}
      {!selectedCategory && categories.length > 12 && (
        <View className="space-y-2">
          <Text className="text-white/70 text-sm mb-2">
            More categories:
          </Text>
          <View className="max-h-48">
            {categories.slice(12).map((category) => (
              <Pressable
                key={category.id}
                onPress={() => handleCategorySelect(category)}
              >
                <GlassCard className="mb-2">
                  <View className="flex-row items-center py-2">
                    <Text className="text-xl mr-3">
                      {category.icon || '📅'}
                    </Text>
                    <View className="flex-1">
                      <Text className="text-white font-medium">
                        {category.name}
                      </Text>
                      {category.description && (
                        <Text className="text-white/60 text-sm">
                          {category.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Validation Error */}
      {!formData.category_id && (
        <Text className="text-red-400 text-sm mt-1">
          Please select a category
        </Text>
      )}

      {/* No Categories Error */}
      {categories.length === 0 && !isLoading && (
        <GlassCard>
          <Text className="text-white/70 text-center">
            No categories available. Please try again later.
          </Text>
        </GlassCard>
      )}
    </View>
  );
};