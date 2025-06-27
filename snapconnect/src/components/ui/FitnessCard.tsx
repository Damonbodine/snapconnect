import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { GradientCard } from './GradientCard';
import { ProgressBar } from './ProgressBar';
import { AnimatedText } from './AnimatedText';

interface FitnessCardProps extends ViewProps {
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  progress: number;
  gradient: string[];
}

export const FitnessCard: React.FC<FitnessCardProps> = ({ title, level, progress, gradient, style, ...props }) => {
  return (
    <GradientCard gradient={gradient} style={[{ padding: 16 }, style]} {...props}>
      <AnimatedText text={title} style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }} />
      <Text style={{ color: 'white', fontSize: 14, marginTop: 8 }}>{level}</Text>
      <ProgressBar progress={progress} gradient={['#a1a1a1', '#f1f1f1']} style={{ marginTop: 16 }} />
    </GradientCard>
  );
};