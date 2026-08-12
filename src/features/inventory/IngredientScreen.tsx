import { PackageCheck, Save } from 'lucide-react';
import { Pressable, Text, TextInput, View } from '../../../lib/web-ui';
import { FormField, PrimaryButton, SectionTitle } from '../../app/components';
import { styles } from '../../app/styles';
import { sanitizeDigits } from '../../shared/lib/numbers';
import { supplyItems } from './catalog';
import type { SupplyItemConfig, SupplyItemInput, SupplyItemStatus } from './model';

export function IngredientScreen({
  note,
  onNoteChange,
  onRowChange,
  onSave,
  rows,
  saving,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onRowChange: (key: string, patch: Partial<SupplyItemInput>) => void;
  onSave: () => void | Promise<void>;
  rows: Record<string, SupplyItemInput>;
  saving: boolean;
}) {
  const quantityItems = supplyItems.filter((item) => item.kind === 'quantity');
  const statusItems = supplyItems.filter((item) => item.kind === 'status');
  return (
    <View style={styles.screen}>
      <SectionTitle icon={PackageCheck} title="Báo đồ" subtitle="Số lượng và tình trạng còn/hết" />
      <View style={styles.supplySection}>
        <Text style={styles.supplySectionTitle}>Có số lượng</Text>
        <View style={styles.supplyGrid}>
          {quantityItems.map((item) => (
            <SupplyItemRow item={item} key={item.key} onChange={(patch) => onRowChange(item.key, patch)} value={rows[item.key] ?? { quantity: '', status: 'available' }} />
          ))}
        </View>
      </View>
      <View style={styles.supplySection}>
        <Text style={styles.supplySectionTitle}>Chỉ trạng thái</Text>
        <View style={styles.supplyGrid}>
          {statusItems.map((item) => (
            <SupplyItemRow item={item} key={item.key} onChange={(patch) => onRowChange(item.key, patch)} value={rows[item.key] ?? { quantity: '', status: 'available' }} />
          ))}
        </View>
      </View>
      <FormField label="Ghi chú" multiline onChangeText={onNoteChange} placeholder="Ví dụ: hàng sắp hết, nguyên liệu lỗi, cần nhập thêm..." value={note} />
      <PrimaryButton disabled={saving} icon={Save} label={saving ? 'Đang gửi...' : 'Gửi báo đồ'} onPress={onSave} tone="primary" />
    </View>
  );
}

function SupplyItemRow({ item, onChange, value }: { item: SupplyItemConfig; onChange: (patch: Partial<SupplyItemInput>) => void; value: SupplyItemInput }) {
  return (
    <View style={styles.supplyItemRow}>
      <View style={styles.supplyItemHeader}>
        <View style={styles.flex}>
          <Text style={styles.supplyItemName}>{item.label}</Text>
          {item.unit ? <Text style={styles.supplyItemUnit}>Đơn vị: {item.unit}</Text> : null}
        </View>
        <SupplyStatusSwitch status={value.status} onChange={(status) => onChange({ status })} />
      </View>
      {item.kind === 'quantity' ? (
        <View style={styles.supplyQuantityRow}>
          <TextInput accessibilityLabel={`Số lượng ${item.label}`} keyboardType="number-pad" onChangeText={(inputValue) => onChange({ quantity: sanitizeDigits(inputValue) })} placeholder="0" placeholderTextColor="#9A806B" style={styles.supplyQuantityInput} value={value.quantity} />
          <Text style={styles.supplyQuantityUnit}>{item.unit}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SupplyStatusSwitch({ onChange, status }: { onChange: (status: SupplyItemStatus) => void; status: SupplyItemStatus }) {
  const isEmpty = status === 'empty';
  return (
    <Pressable accessibilityLabel={`Trạng thái ${isEmpty ? 'hết' : 'còn'}`} accessibilityRole="button" onPress={() => onChange(isEmpty ? 'available' : 'empty')} style={({ pressed }) => [styles.supplyStatusToggle, isEmpty ? styles.supplyStatusToggleEmpty : styles.supplyStatusToggleAvailable, pressed && styles.pressed]}>
      <Text style={styles.supplyStatusToggleText}>{isEmpty ? 'Hết' : 'Còn'}</Text>
    </Pressable>
  );
}
