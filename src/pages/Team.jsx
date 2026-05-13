import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Shield, Users as UsersIcon, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const roleColors = {
  owner: 'bg-primary/10 text-primary',
  manager: 'bg-accent/20 text-accent-foreground',
  staff: 'bg-secondary text-secondary-foreground',
  accountant: 'bg-emerald-100 text-emerald-700',
};

const roleLabels = { owner: 'Owner', manager: 'Manager', staff: 'Staff', accountant: 'Accountant' };

export default function Team() {
  const { company, canManageTeam, userRole } = useCompany();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ user_email: '', user_name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team', company?.id],
    queryFn: () => base44.entities.TeamMember.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.user_email.trim()) {
      toast.error('Email is required');
      return;
    }
    const exists = members.find(m => m.user_email === form.user_email);
    if (exists) {
      toast.error('This person is already a team member');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.TeamMember.create({
        company_id: company.id,
        user_email: form.user_email,
        user_name: form.user_name,
        role: form.role,
        status: 'active'
      });
      // Also invite the user to the app
      try {
        await base44.users.inviteUser(form.user_email, 'user');
      } catch (e) {
        // User may already exist
      }
      toast.success('Team member added');
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setShowAdd(false);
      setForm({ user_email: '', user_name: '', role: 'staff' });
    } catch (err) {
      toast.error('Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (member) => {
    if (member.role === 'owner') {
      toast.error('Cannot remove the owner');
      return;
    }
    try {
      await base44.entities.TeamMember.update(member.id, { status: 'inactive' });
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Team</h1>
        {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground">{activeMembers.length} member(s)</p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Add
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {activeMembers.map(member => (
          <Card key={member.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{member.user_name || member.user_email}</p>
                <p className="text-xs text-muted-foreground">{member.user_email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={roleColors[member.role]}>{roleLabels[member.role]}</Badge>
              {canManageTeam && member.role !== 'owner' && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(member)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.user_email} onChange={e => setForm(p => ({ ...p, user_email: e.target.value }))} placeholder="team@company.fj" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.user_name} onChange={e => setForm(p => ({ ...p, user_name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.role === 'manager' && 'Can upload, approve receipts, and manage team'}
                {form.role === 'staff' && 'Can upload receipts only'}
                {form.role === 'accountant' && 'Can view and export reports only'}
              </p>
            </div>
            <Button type="submit" disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {saving ? 'Adding...' : 'Add Member'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}