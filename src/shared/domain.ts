export type UserRole = 'owner' | 'manager' | 'employee';
export type EmploymentType = 'full_time' | 'part_time';

export type Branch = {
  id: string;
  name: string;
  area: string;
  address: string;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
  phone: string;
  avatarUrl: string;
  employmentType: EmploymentType;
  startDate: string;
  dateOfBirth: string;
  hourlyRate: number;
  allowance: number;
  breakfastAllowance: number;
};

export const branches: Branch[] = [
  {
    id: 'minh-khai-1',
    name: 'Chi nhánh Minh Khai 1',
    area: 'Nguyễn Thị Minh Khai',
    address: '147A Nguyễn Thị Minh Khai, Phường Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh',
  },
  {
    id: 'minh-khai-2',
    name: 'Chi nhánh Minh Khai 2',
    area: 'Nguyễn Thị Minh Khai',
    address: '123 Nguyễn Thị Minh Khai, Phường Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh',
  },
  {
    id: 'nam-ky-khoi-nghia',
    name: 'Chi nhánh Nam Kỳ Khởi Nghĩa',
    area: 'Nam Kỳ Khởi Nghĩa',
    address: '151C Nam Kỳ Khởi Nghĩa, Phường 6, Xuân Hòa, Hồ Chí Minh',
  },
  {
    id: 'dien-bien-phu',
    name: 'Chi nhánh Điện Biên Phủ',
    area: 'Điện Biên Phủ',
    address: '435 Điện Biên Phủ, Phường 3, Bàn Cờ, Hồ Chí Minh',
  },
  {
    id: 'pham-dinh-ho',
    name: 'Chi nhánh Phạm Đình Hổ',
    area: 'Phạm Đình Hổ',
    address: '49 Phạm Đình Hổ, Phường 2, Bình Tây, Hồ Chí Minh',
  },
  {
    id: 'tung-thien-vuong',
    name: 'Chi nhánh Tùng Thiện Vương',
    area: 'Tùng Thiện Vương',
    address: '415 Tùng Thiện Vương, Phường Xóm Củi, Phú Định, Hồ Chí Minh',
  },
];

export const defaultBranchId = branches[0].id;

export const payrollPolicy = {
  hourlyRate: 24000,
  breakfastPerMorningShift: 27000,
  monthlyAllowance: 200000,
} as const;
