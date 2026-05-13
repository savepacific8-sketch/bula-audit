import { Card } from '@/components/ui/card';

export default function StatCard({ title, value, icon: Icon, color }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-xl md:text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${color || 'bg-primary/10'}`}>
          <Icon className={`w-5 h-5 ${color ? 'text-white' : 'text-primary'}`} />
        </div>
      </div>
    </Card>
  );
}