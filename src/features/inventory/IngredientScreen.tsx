import { ClipboardList, PackageCheck, Save } from 'lucide-react';
import { Pressable, Text, TextInput, View } from '../../../lib/web-ui';
import { FormField, HistoryList, HistoryRow, PrimaryButton, SectionTitle } from '../../app/components';
import { styles } from '../../app/styles';
import { sanitizeDigits } from '../../shared/lib/numbers';
import { supplyItems } from './catalog';
import type {
  IngredientReport,
  SupplyItemConfig,
  SupplyItemInput,
  SupplyItemStatus,
  SupplyReportItem,
} from './model';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

const formatSupplyItemValue = (item: SupplyReportItem) => {
  if (item.status === 'empty') return `${item.label}: hết`;
  if (item.quantity.trim()) return `${item.label}: ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
  return `${item.label}: còn`;
};

const formatSupplyReportSummary = (report: IngredientReport) => {
  if (report.items?.length) {
    const filledItems = report.items.filter((item) => item.status === 'empty' || item.quantity.trim());
    if (filledItems.length === 0) return 'Chưa nhập số lượng, tất cả trạng thái còn';
    const summary = filledItems.slice(0, 4).map(formatSupplyItemValue).join(' - ');
    const remainingCount = filledItems.length - 4;
    return remainingCount > 0 ? `${summary} - thêm ${remainingCount} món` : summary;
  }
  return `Dùng ${formatNumber(report.used ?? 0)} ${report.unit ?? ''} - tồn ${formatNumber(report.currentStock ?? 0)} ${report.unit ?? ''}`;
};

export function IngredientScreen({
  note,
  onNoteChange,
  onRowChange,
  onSave,
  records,
  rows,
  saving,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onRowChange: (key: string, patch: Partial<SupplyItemInput>) => void;
  onSave: () => void | Promise<void>;
  records: IngredientReport[];
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
      <HistoryList emptyText="Chưa có báo đồ." icon={ClipboardList} title="Báo đồ gần đây">
        {records.slice(0, 8).map((report) => (
          <HistoryRow key={report.id} meta={formatDateTime(report.timestamp)} title={report.items?.length ? 'Báo đồ' : report.itemName ?? 'Báo đồ'} value={formatSupplyReportSummary(report)} />
        ))}
      </HistoryList>
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
