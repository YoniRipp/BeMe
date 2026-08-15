import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersApi, type ApiUserListItem, type UserRole } from '@/lib/api';
import { toast } from '@/components/shared/ToastProvider';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
type RoleFilter = 'all' | 'admin' | 'user';
type SortKey = 'name' | 'email' | 'createdAt';
type SortDir = 'asc' | 'desc';

export function AdminUsersTable() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ApiUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUserListItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUserListItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await usersApi.list();
      setUsers(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load users. Please try again.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredAndSorted = useMemo(() => {
    let list = users;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role === roleFilter);
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'email') cmp = a.email.localeCompare(b.email);
      else cmp = (new Date(a.createdAt ?? 0).getTime()) - (new Date(b.createdAt ?? 0).getTime());
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [users, searchQuery, roleFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filteredAndSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredAndSorted, page]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Users</h3>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(0);
          }}
          className="max-w-xs"
        />
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as RoleFilter); setPage(0); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add user
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading users...</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => toggleSort('name')}
                    >
                      Name <SortIcon column="name" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => toggleSort('email')}
                    >
                      Email <SortIcon column="email" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => toggleSort('createdAt')}
                    >
                      Created <SortIcon column="createdAt" />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{u.name}</td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{u.role}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate('/admin/user-data', { state: { user: u } })}
                          aria-label="View user data"
                          title="View user data"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditUser(u)}
                          aria-label="Edit user"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80"
                          onClick={() => setDeleteUser(u)}
                          aria-label="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="hidden md:flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                {filteredAndSorted.length} user{filteredAndSorted.length !== 1 ? 's' : ''}
                {filteredAndSorted.length > PAGE_SIZE && ` · Page ${page + 1} of ${totalPages}`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <div className="md:hidden space-y-2 mt-4">
            {paginated.map((u) => (
              <div
                key={u.id}
                className={cn('flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/20')}
              >
                <div className="min-w-0">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                    {u.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/user-data', { state: { user: u } })} aria-label="View data">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(u)} aria-label="Edit">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteUser(u)} aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="md:hidden flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={() => { setCreateOpen(false); fetchUsers(); }} />
      {editUser && (
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null); }}
          onSuccess={() => { setEditUser(null); fetchUsers(); }}
        />
      )}
      {deleteUser && (
        <ConfirmationDialog
          open={!!deleteUser}
          onOpenChange={(open) => { if (!open) setDeleteUser(null); }}
          title="Delete user"
          message={`Are you sure you want to delete ${deleteUser.name} (${deleteUser.email})? This cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={async () => {
            try {
              await usersApi.delete(deleteUser.id);
              toast.success('User deleted');
              setDeleteUser(null);
              fetchUsers();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not delete user. Please try again.');
            }
          }}
        />
      )}
    </Card>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      toast.error('Password must contain at least one uppercase letter, one lowercase letter, and one digit');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.create({ email: email.trim(), password, name: name.trim(), role });
      toast.success('User created');
      setEmail(''); setPassword(''); setName(''); setRole('user');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create a new user account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="create-name">Name</Label>
            <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="create-email">Email</Label>
            <Input id="create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="create-password">Password</Label>
            <Input id="create-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: ApiUserListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length > 0) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        toast.error('Password must contain at least one uppercase letter, one lowercase letter, and one digit');
        return;
      }
    }
    setSubmitting(true);
    try {
      await usersApi.update(user.id, {
        name: name.trim(),
        role,
        ...(password ? { password } : {}),
      });
      toast.success('User updated');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update name, role, or password for {user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-password">New password (leave blank to keep)</Label>
            <Input id="edit-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
