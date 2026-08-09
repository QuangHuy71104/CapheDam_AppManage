import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from '../../lib/web-ui';
import { sanitizeDigits } from '../shared/lib/numbers';
import { colors } from '../shared/ui/theme';
import { styles } from './styles';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);

export function MetricTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'teal' | 'amber' | 'blue';
  value: string;
}) {
  const toneStyle = {
    teal: { backgroundColor: colors.primarySoft, borderColor: colors.lineStrong, color: colors.primary },
    amber: { backgroundColor: colors.amberSoft, borderColor: '#E2B889', color: colors.amber },
    blue: { backgroundColor: colors.blueSoft, borderColor: '#B8C7AE', color: colors.blue },
  }[tone];

  return (
    <View style={[styles.metricTile, { borderColor: toneStyle.borderColor }]}>
      <View style={[styles.metricAccent, { backgroundColor: toneStyle.color }]} />
      <View style={[styles.metricIcon, { backgroundColor: toneStyle.backgroundColor }]}>
        <Icon color={toneStyle.color} size={18} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function SectionTitle({
  icon: Icon,
  subtitle,
  title,
}: {
  icon: LucideIcon;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Icon color={colors.primary} size={21} />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function FormField({
  icon: Icon,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  keyboardType,
  label,
  multiline,
  onChangeText,
  placeholder,
  secureTextEntry,
  textContentType,
  trailingAction,
  value,
}: {
  icon?: LucideIcon;
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  trailingAction?: { icon: LucideIcon; label: string; onPress: () => void };
  value: string;
}) {
  const TrailingIcon = trailingAction?.icon;
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputShell, multiline && styles.inputShellMultiline]}>
        {Icon ? <Icon color={colors.muted} size={18} /> : null}
        <TextInput
          accessibilityLabel={label}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9A806B"
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.inputMultiline]}
          textContentType={textContentType}
          value={value}
        />
        {TrailingIcon && trailingAction ? (
          <Pressable
            accessibilityLabel={trailingAction.label}
            accessibilityRole="button"
            onPress={trailingAction.onPress}
            style={({ pressed }) => [styles.inputTrailingButton, pressed && styles.pressed]}
          >
            <TrailingIcon color={colors.muted} size={18} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ClosingFormField({
  error,
  label,
  numeric = true,
  onChangeText,
  required,
  suffix,
  value,
}: {
  error?: boolean;
  label: string;
  numeric?: boolean;
  onChangeText: (value: string) => void;
  required?: boolean;
  suffix?: string;
  value: string;
}) {
  return (
    <View style={[styles.closingCard, error && styles.closingCardError]}>
      <Text style={styles.closingLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={numeric ? 'number-pad' : 'default'}
        multiline
        onChangeText={(inputValue) => onChangeText(numeric ? sanitizeDigits(inputValue) : inputValue)}
        placeholderTextColor="#9A806B"
        style={[styles.closingInput, error && styles.closingInputError]}
        textAlignVertical="top"
        value={value}
      />
      {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
    </View>
  );
}

export function TransferSumField({
  label,
  onChangeText,
  total,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  total: number;
  value: string;
}) {
  return (
    <View style={styles.closingCard}>
      <Text style={styles.closingLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="default"
        onChangeText={onChangeText}
        placeholderTextColor="#9A806B"
        style={styles.closingInput}
        value={value}
      />
      <Text style={styles.transferTotal}>Tổng: {formatNumber(total)}</Text>
    </View>
  );
}

export function PrimaryButton({
  disabled = false,
  icon: Icon,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone: 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        tone === 'danger' && styles.dangerButton,
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon color={colors.onDark} size={19} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function HistoryList({
  children,
  emptyText,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  emptyText: string;
  icon: LucideIcon;
  title: string;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <View style={styles.history}>
      <View style={styles.historyHeader}>
        <Icon color={colors.ink} size={18} />
        <Text style={styles.historyTitle}>{title}</Text>
      </View>
      {hasChildren ? children : <Text style={styles.emptyText}>{emptyText}</Text>}
    </View>
  );
}

export function HistoryRow({
  meta,
  onPress,
  title,
  value,
}: {
  meta?: string;
  onPress?: () => void;
  title: string;
  value: string;
}) {
  const content = (
    <>
      <View style={styles.flex}>
        <Text style={styles.historyRowTitle}>{title}</Text>
        {meta ? <Text style={styles.historyRowMeta}>{meta}</Text> : null}
        <Text style={styles.historyRowValue}>{value}</Text>
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.historyRow}>{content}</View>
  );
}

export function isToday(value: string) {
  const inputDate = new Date(value);
  const today = new Date();
  return (
    inputDate.getFullYear() === today.getFullYear() &&
    inputDate.getMonth() === today.getMonth() &&
    inputDate.getDate() === today.getDate()
  );
}
