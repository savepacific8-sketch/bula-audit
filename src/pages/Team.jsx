import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserPlus, Loader2, Trash2, ShieldCheck, RefreshCw,
  Upload, Eye, CheckSquare, FileBarChart, Settings, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const ROLES = [
  {
    value: 'owner',
    label: 'Owner',
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Full access to everything',
    permissions: [
      { icon: Upload, text: 'Upload receipts' },
      { icon: Eye, text: 'View all receipts' },
      { icon: CheckSquare, text: 'Approve & reject receipts' },
      { icon: FileBarChart, text: 'View & export reports' },
      { icon: Settings, text: 'Manage team & company settings' },
    ],
  },
  {
    value: 'manager',
    label: 'Manager',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Upload, review and approve receipts',
    permissions: [
      { icon: Upload, text: 'Upload receipts' },
      { icon: Eye, text: 'View all receipts' },
      { icon: CheckSquare, text: 'Approve & reject receipts' },
      { icon: FileBarChart, text: 'View & export reports' },
    ],
  },
  {
    value: 'accountant',
    label: 'Accountant',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    description: 'View reports and export data',
    permissions: [
      { icon: Eye, text: 'View approved receipts' },
      { icon: FileBarChart, text: 'View & export reports' },
    ],
  },
  {
    value: 'staff',
    label: 'Staff',
    color: 'bg-secondary text-secondary-foreground border-border',
    description: 'Upload receipts and view own uploads',
    permissions: [
      { icon: Upload, text: 'Upload receipts' },
      { icon: Eye, text: 'View own receipts only' },
    ],
  },
];

const roleMap = Object.fromEntries(ROLES.map(r => [r.value, r]));

export default function Team() {
  const { company, canManageTeam, userRole } = useCompany();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ user_email: '', user_name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team', company?.id],
    queryFn: () => base44.entities.TeamMember.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const activeMembers = members.filter(m => m.status === 'active');
  const inactiveMembers = members.filter(m => m.status === 'inactive');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.user_email.trim()) { toast.error('Email is required'); return; }
    if (members.find(m => m.user_email === form.user_email && m.status === 'active')) {
      toast.error('This person is already an active team member');
      return;
    }
    setSaving(true);
    try {
      // Reactivate if previously removed
      const existing = members.find(m => m.user_email === form.user_email);
      if (existing) {
        await base44.entities.TeamMember.update(existing.id, { status: 'active', role: form.role, user_name: form.user_name || existing.user_name });
      } else {
        await base44.entities.TeamMember.create({
          company_id: company.id,
          user_email: form.user_email,
          user_name: form.user_name,
          role: form.role,
          status: 'active',
        });
        try { await base44.users.inviteUser(form.user_email, 'user'); } catch {}
      }
      toast.success('Team member added');
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setShowAdd(false);
      setForm({ user_email: '', user_name: '', role: 'staff' });
    } catch {
      toast.error('Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (member, newRole) => {
    if (newRole === member.role) return;
    setUpdatingId(member.id);
    try {
      await base44.entities.TeamMember.update(member.id, { role: newRole });
      toast.success(`Role updated to ${roleMap[newRole]?.label}`);
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (member) => {
    if (member.role === 'owner') { toast.error('Cannot remove the owner'); return; }
    setUpdatingId(member.id);
    try {
      await base44.entities.TeamMember.update(member.id, { status: 'inactive' });
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRestore = async (member) => {
    setUpdatingId(member.id);
    try {
      await base44.entities.TeamMember.update(member.id, { status: 'active' });
      toast.success('Member restored');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch {
      toast.error('Failed to restore member');
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedRole = ROLES.find(r => r.value === form.role);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Team</h1>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle={`${activeMembers.length} active member${activeMembers.length !== 1 ? 's' : ''}`}
        action={canManageTeam && (
          <Button
            onClick={() => setShowAdd(true)}
            className="gap-2 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow"
            style={{ background: 'hsl(var(--accent))' }}
          >
            <UserPlus className="w-4 h-4" /> Invite Member
          </Button>
        )}
      />

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members ({activeMembers.length})</TabsTrigger>
          <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
          {inactiveMembers.length > 0 && (
            <TabsTrigger value="removed">Removed ({inactiveMembers.length})</TabsTrigger>
          )}
        </TabsList>

        {/* Active Members */}
        <TabsContent value="members" className="space-y-3 mt-4">
          {activeMembers.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground text-sm">No team members yet.</Card>
          )}
          {activeMembers.map(member => {
            const role = roleMap[member.role];
            const isUpdating = updatingId === member.id;
            return (
              <Card key={member.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.user_name || member.user_email}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.user_email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canManageTeam && member.role !== 'owner' ? (
                      <Select
                        value={member.role}
                        onValueChange={v => handleRoleChange(member, v)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className={`h-7 text-xs px-2 border rounded-full w-32 ${role?.color}`}>
                          {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <SelectValue />}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="accountant">Accountant</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`text-xs rounded-full ${role?.color}`}>{role?.label}</Badge>
                    )}
                    {canManageTeam && member.role !== 'owner' && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(member)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* Permissions Reference */}
        <TabsContent value="permissions" className="mt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {ROLES.map(role => (
              <Card key={role.value} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">{role.label}</span>
                  <Badge className={`text-xs ml-auto rounded-full ${role.color}`}>{role.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{role.description}</p>
                <ul className="space-y-1.5">
                  {role.permissions.map((perm, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                      <perm.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {perm.text}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Removed Members */}
        {inactiveMembers.length > 0 && (
          <TabsContent value="removed" className="space-y-3 mt-4">
            {inactiveMembers.map(member => (
              <Card key={member.id} className="p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">
                      {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.user_name || member.user_email}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.user_email}</p>
                  </div>
                  {canManageTeam && (
                    <Button
                      variant="outline" size="sm"
                      className="gap-1 text-xs"
                      onClick={() => handleRestore(member)}
                      disabled={updatingId === member.id}
                    >
                      {updatingId === member.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />}
                      Restore
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </TabsContent>
        )}
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-1">
            <div>
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                autoFocus
                value={form.user_email}
                onChange={e => setForm(p => ({ ...p, user_email: e.target.value }))}
                placeholder="team@company.fj"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Full Name</Label>
              <Input
                value={form.user_name}
                onChange={e => setForm(p => ({ ...p, user_name: e.target.value }))}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
              {selectedRole && (
                <div className="mt-2 p-3 rounded-lg bg-secondary/50 space-y-1">
                  <p className="text-xs font-medium">{selectedRole.description}</p>
                  <ul className="space-y-1">
                    {selectedRole.permissions.map((perm, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <perm.icon className="w-3 h-3 text-primary" /> {perm.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button type="submit" disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {saving ? 'Inviting...' : 'Send Invite'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}