import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
};

export const UserAvatar = ({ name, avatarUrl, size = 'md', className }: UserAvatarProps) => {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar'}
        className={cn(sizeClass, 'rounded-lg object-cover shrink-0', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        sizeClass,
        'rounded-lg flex items-center justify-center font-bold bg-[#D6EEB1] text-[#2A2A2A] shrink-0',
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
};

export default UserAvatar;
