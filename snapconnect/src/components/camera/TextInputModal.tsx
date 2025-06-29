import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: screenWidth } = Dimensions.get('window');

interface TextInputModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (text: string, options: TextOptions) => void;
  initialText?: string;
  initialOptions?: Partial<TextOptions>;
  isEditing?: boolean;
}

interface TextOptions {
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  fontFamily: string;
}

const TEXT_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#FF3B30' },
  { name: 'Blue', value: '#007AFF' },
  { name: 'Green', value: '#34C759' },
  { name: 'Yellow', value: '#FFCC00' },
  { name: 'Purple', value: '#AF52DE' },
  { name: 'Pink', value: '#FF2D92' },
];

const FONT_FAMILIES = [
  { name: 'System', value: 'System' },
  { name: 'Bold', value: 'System' },
  { name: 'Italic', value: 'System' },
];

const FONT_SIZES = [
  { name: 'Small', value: 18 },
  { name: 'Medium', value: 24 },
  { name: 'Large', value: 32 },
  { name: 'XL', value: 40 },
];

export const TextInputModal: React.FC<TextInputModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  initialText = '',
  initialOptions,
  isEditing = false,
}) => {
  const [text, setText] = useState(initialText);
  const [selectedColor, setSelectedColor] = useState(initialOptions?.color || '#FFFFFF');
  const [selectedSize, setSelectedSize] = useState(initialOptions?.fontSize || 24);
  const [isBold, setIsBold] = useState(initialOptions?.fontWeight === 'bold');
  const [isItalic, setIsItalic] = useState(initialOptions?.fontStyle === 'italic');

  const handleSubmit = () => {
    if (text.trim()) {
      const options: TextOptions = {
        color: selectedColor,
        fontSize: selectedSize,
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
        fontFamily: 'System',
      };
      onSubmit(text.trim(), options);
      setText('');
      setSelectedColor('#FFFFFF');
      setSelectedSize(24);
      setIsBold(false);
      setIsItalic(false);
      onClose();
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      setText('');
      setSelectedColor('#FFFFFF');
      setSelectedSize(24);
      setIsBold(false);
      setIsItalic(false);
    }
    onClose();
  };

  // Update state when modal opens with new values
  React.useEffect(() => {
    if (isVisible) {
      setText(initialText);
      setSelectedColor(initialOptions?.color || '#FFFFFF');
      setSelectedSize(initialOptions?.fontSize || 24);
      setIsBold(initialOptions?.fontWeight === 'bold');
      setIsItalic(initialOptions?.fontStyle === 'italic');
    }
  }, [isVisible, initialText, initialOptions]);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView style={styles.overlay} intensity={20} tint="dark">
        <View style={styles.modal}>
          <LinearGradient
            colors={['#1F1F23', '#2C2C2E']}
            style={styles.modalContent}
          >
            <Text style={styles.title}>{isEditing ? 'Edit Text' : 'Add Text'}</Text>
            
            <TextInput
              style={[
                styles.textInput, 
                { 
                  color: selectedColor,
                  fontSize: selectedSize,
                  fontWeight: isBold ? 'bold' : 'normal',
                  fontStyle: isItalic ? 'italic' : 'normal',
                }
              ]}
              value={text}
              onChangeText={setText}
              placeholder="Enter your text..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline={false}
              maxLength={50}
              autoFocus={true}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <Text style={styles.sectionTitle}>Text Size</Text>
            <View style={styles.sizeGrid}>
              {FONT_SIZES.map((size) => (
                <Pressable
                  key={size.value}
                  style={[
                    styles.sizeButton,
                    selectedSize === size.value && styles.selectedSize,
                  ]}
                  onPress={() => setSelectedSize(size.value)}
                >
                  <Text style={[styles.sizeText, selectedSize === size.value && styles.selectedSizeText]}>
                    {size.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Text Style</Text>
            <View style={styles.styleRow}>
              <Pressable
                style={[styles.styleButton, isBold && styles.selectedStyle]}
                onPress={() => setIsBold(!isBold)}
              >
                <Text style={[styles.styleText, isBold && styles.selectedStyleText]}>Bold</Text>
              </Pressable>
              <Pressable
                style={[styles.styleButton, isItalic && styles.selectedStyle]}
                onPress={() => setIsItalic(!isItalic)}
              >
                <Text style={[styles.styleText, isItalic && styles.selectedStyleText]}>Italic</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Text Color</Text>
            <View style={styles.colorGrid}>
              {TEXT_COLORS.map((color) => (
                <Pressable
                  key={color.value}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color.value },
                    selectedColor === color.value && styles.selectedColor,
                  ]}
                  onPress={() => setSelectedColor(color.value)}
                />
              ))}
            </View>

            <View style={styles.buttonRow}>
              <Pressable style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.submitButton, !text.trim() && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={!text.trim()}
              >
                <LinearGradient
                  colors={text.trim() ? ['#7C3AED', '#EC4899'] : ['#666', '#666']}
                  style={styles.submitGradient}
                >
                  <Text style={styles.submitText}>{isEditing ? 'Update Text' : 'Add Text'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    width: screenWidth - 40,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  sizeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sizeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedSize: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sizeText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedSizeText: {
    fontWeight: 'bold',
  },
  styleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  styleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedStyle: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  styleText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedStyleText: {
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});