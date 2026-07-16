import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DEFAULT_API_URL = 'http://localhost:5000';
// const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'https://voice-api-production-703d.up.railway.app';
const STORAGE_KEY = 'glix-official-session';

const navItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'hosts', label: 'Host Requests' },
  { key: 'agencies', label: 'Agencies' },
  { key: 'agencyRequests', label: 'Agency Requests' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'store', label: 'Store' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'accessRequests', label: 'Official Access Requests' },
  { key: 'coinSellers', label: 'Coin Seller Requests' },
  { key: 'sellerBalances', label: 'Seller Balances' },
  { key: 'monthlyCommissions', label: 'Monthly Commissions' },
];

const money = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));
const shortId = (value) => value ? `${String(value).slice(0, 6)}...${String(value).slice(-4)}` : '-';
const niceDate = (value) => value ? new Date(value).toLocaleString() : '-';

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.trim().slice(0, 80);
    const htmlHint = preview.startsWith('<')
      ? 'API returned HTML instead of JSON. Check the API URL and backend route.'
      : 'API returned a non-JSON response.';
    throw new Error(`${htmlHint} URL: ${response.url}`);
  }
}

function useAdminApi(session, setSession) {
  const apiBase = session?.apiBase || DEFAULT_API_URL;

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await parseApiResponse(response);
    if (!response.ok || data?.success === false) {
      if (response.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      }
      throw new Error(data?.message || data?.errorMsg || `Request failed (${response.status})`);
    }
    return data;
  }, [apiBase, session?.token, setSession]);

  return { apiBase, request };
}

function StatusBadge({ value }) {
  const clean = value || 'none';
  return <span className={`badge badge-${clean}`}>{clean}</span>;
}

function EmptyState({ children = 'No data found.' }) {
  return <div className="empty">{children}</div>;
}

function Login({ onLogin }) {
  const [apiBase, setApiBase] = useState(DEFAULT_API_URL);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [requestedRole, setRequestedRole] = useState('super_admin');
  const [requestNote, setRequestNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data?.message || 'Login failed');
      const role = data?.user?.role || 'user';
      const accountStatus = data?.user?.accountStatus || data?.user?.status;
      if (role !== 'super_admin') {
        throw new Error('Only the Super Admin can access the Official Portal.');
      }
      if (accountStatus && accountStatus !== 'active') {
        throw new Error(`Your Official Portal account is ${accountStatus}. Please wait for approval.`);
      }
      const nextSession = { apiBase, token: data.token, user: data.user };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      onLogin(nextSession);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitForgotPassword = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/admin/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to send OTP');
      setNotice(data?.devOtp ? `${data.message} Dev OTP: ${data.devOtp}` : data?.message || 'OTP sent to your email.');
      setMode('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitResetPassword = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/admin/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to reset password');
      setPassword('');
      setOtp('');
      setNewPassword('');
      setMode('login');
      setNotice(data?.message || 'Password reset successful. You can sign in now.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitAccessRequest = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/admin/access/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, requestedRole, note: requestNote }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to request access');
      setNotice(data?.message || 'Official access request submitted. Wait for Super Admin approval.');
      setRequestNote('');
      setMode('login');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const isRegister = mode === 'register';

  return (
    <main className="loginPage">
      <form className="loginPanel" onSubmit={isLogin ? submitLogin : isForgot ? submitForgotPassword : isRegister ? submitAccessRequest : submitResetPassword}>
        <div>
          <p className="eyebrow">Glix Live</p>
          <h1>{isLogin ? 'Official Portal' : isForgot ? 'Reset Password' : isRegister ? 'Request Official Access' : 'Enter OTP'}</h1>
          <p className="muted">
            {isLogin
              ? 'Super Admin access only. All other roles must use their own app or portal.'
              : isRegister
                ? 'Official access is restricted to the Super Admin role only.'
                : isForgot
                  ? 'Enter your Super Admin email and we will send a six digit OTP.'
                  : 'Enter the OTP from your email and choose a new password.'}
          </p>
        </div>
        {error && <div className="errorBox">{error}</div>}
        {notice && <div className="noticeBox">{notice}</div>}
        <label>
          API Base URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
        </label>
        {isRegister && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {isRegister && (
          <label>
            Requested Role
            <select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value)}>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
        )}
        {(isLogin || isRegister) && (
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={isRegister ? 6 : undefined} required />
          </label>
        )}
        {isRegister && (
          <label>
            Request Note
            <textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Why do you need official portal access?" />
          </label>
        )}
        {isReset && (
          <>
            <label>
              OTP Code
              <input inputMode="numeric" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </label>
            <label>
              New Password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength="6" required />
            </label>
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait...' : isLogin ? 'Sign In' : isForgot ? 'Send OTP' : isRegister ? 'Submit Request' : 'Reset Password'}
        </button>
        <div className="loginLinks">
          {isLogin ? (
            <>
              <button type="button" className="linkButton" onClick={() => { setError(''); setNotice(''); setMode('forgot'); }}>
                Forgot password?
              </button>
              
            </>
          ) : (
            <button type="button" className="linkButton" onClick={() => { setError(''); setMode('login'); }}>
              Back to sign in
            </button>
          )}
          {isForgot && (
            <button type="button" className="linkButton" onClick={() => { setError(''); setNotice(''); setMode('reset'); }}>
              I already have an OTP
            </button>
          )}
        </div>
      </form>
    </main>
  );
}function Shell({ session, setSession, children, active, setActive }) {
  const role = session?.user?.role || 'user';
  const availableItems = role === 'super_admin' ? navItems : [];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">G</div>
          <div>
            <strong>Glix Official</strong>
            <span>{role}</span>
          </div>
        </div>
        <nav>
          {availableItems.map(item => (
            <button
              key={item.key}
              className={active === item.key ? 'active' : ''}
              onClick={() => setActive(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          className="logout"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setSession(null);
          }}
        >
          Logout
        </button>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Official Control Center</p>
            <h2>{availableItems.find(item => item.key === active)?.label || 'Dashboard'}</h2>
          </div>
          <div className="userPill">
            <span>{session?.user?.name || 'Super Admin'}</span>
            <small>{session?.user?.email}</small>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

function Dashboard({ request }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request('/admin/dashboard');
      setStats(data.stats);
    } catch (err) {
      setError(err.message);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const cards = [
    ['Total Users', stats?.totalUsers],
    ['Active Users', stats?.activeUsers],
    ['Suspended/Banned', stats?.suspendedUsers],
    ['Pending Hosts', stats?.pendingHosts],
    ['Pending Agencies', stats?.pendingAgencies],
    ['Pending Withdrawals', stats?.pendingWithdrawals],
    ['Live Rooms', stats?.liveRooms],
    ['Weekly Gift Coins', stats?.weeklyGiftCoins],
  ];

  return (
    <Panel error={error} onRefresh={load}>
      <div className="statGrid">
        {cards.map(([label, value]) => (
          <div className="statCard" key={label}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
          </div>
        ))}
      </div>
      <div className="infoStrip">
        <span>Audio rooms live: {money(stats?.liveAudioRooms)}</span>
        <span>Video rooms live: {money(stats?.liveVideoRooms)}</span>
        <span>Weekly gift transactions: {money(stats?.weeklyGiftTransactions)}</span>
      </div>
    </Panel>
  );
}

function Panel({ error, onRefresh, children, actions = null }) {
  return (
    <div className="panel">
      <div className="panelActions">
        <div>{error && <span className="errorText">{error}</span>}</div>
        <div className="rowActions">
          {actions}
          {onRefresh && <button onClick={onRefresh}>Refresh</button>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Users({ request }) {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', role: 'all', accountStatus: 'all' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 25, ...filters });
      const data = await request(`/admin/users?${params}`);
      setUsers(data.users || []);
      setMeta({ page: data.page, pages: data.pages, total: data.total });
    } catch (err) {
      setError(err.message);
    }
  }, [filters, request]);

  useEffect(() => { load(1); }, [load]);

  const saveUser = async (payload) => {
    await request(`/admin/users/${editing._id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    setEditing(null);
    load(meta.page);
  };

  return (
    <Panel error={error} onRefresh={() => load(meta.page)}>
      <div className="filters">
        <input placeholder="Search name, email, Glix ID" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
          {['all', 'user', 'host', 'agency', 'manager', 'admin', 'coin_seller', 'super_admin'].map(item => <option key={item}>{item}</option>)}
        </select>
        <select value={filters.accountStatus} onChange={(e) => setFilters({ ...filters, accountStatus: e.target.value })}>
          {['all', 'active', 'suspended', 'banned'].map(item => <option key={item}>{item}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Wallet</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {users.map(user => (
            <tr key={user._id}>
              <td><strong>{user.name}</strong><small>{user.email}<br />{user.glixId || shortId(user._id)}</small></td>
              <td><StatusBadge value={user.role} /></td>
              <td><StatusBadge value={user.accountStatus || 'active'} /></td>
              <td>{money(user.chang)} coins<br /><small>{money(user.daimon)} diamonds</small></td>
              <td>{niceDate(user.createdAt)}</td>
              <td><button onClick={() => setEditing(user)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!users.length && <EmptyState />}
      <div className="pager">
        <button disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>Previous</button>
        <span>Page {meta.page} / {meta.pages || 1} · {money(meta.total)} users</span>
        <button disabled={meta.page >= meta.pages} onClick={() => load(meta.page + 1)}>Next</button>
      </div>
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} onSave={saveUser} />}
    </Panel>
  );
}

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    role: user.role || 'user',
    accountStatus: user.accountStatus || 'active',
    hostStatus: user.hostStatus || 'none',
    agencyStatus: user.agencyStatus || 'none',
    chang: user.chang || 0,
    daimon: user.daimon || 0,
    adminNote: user.adminNote || '',
  });
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  return (
    <div className="modalBackdrop">
      <form className="modal" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <h3>{user.name}</h3>
        <div className="formGrid">
          <label>Role<select value={form.role} onChange={(e) => set('role', e.target.value)}>{['user', 'host', 'agency', 'manager', 'admin', 'coin_seller', 'super_admin'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Account<select value={form.accountStatus} onChange={(e) => set('accountStatus', e.target.value)}>{['active', 'suspended', 'banned'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Host<select value={form.hostStatus} onChange={(e) => set('hostStatus', e.target.value)}>{['none', 'pending', 'approved', 'rejected'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Agency<select value={form.agencyStatus} onChange={(e) => set('agencyStatus', e.target.value)}>{['none', 'pending', 'approved', 'rejected'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Coins<input type="number" value={form.chang} onChange={(e) => set('chang', e.target.value)} /></label>
          <label>Diamonds<input type="number" value={form.daimon} onChange={(e) => set('daimon', e.target.value)} /></label>
        </div>
        <label>Official note<textarea value={form.adminNote} onChange={(e) => set('adminNote', e.target.value)} /></label>
        <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save</button></div>
      </form>
    </div>
  );
}

function Requests({ request, type }) {
  const isHost = type === 'hosts';
  const endpoint = isHost ? '/host/requests' : '/agency/requests';
  const reviewEndpoint = isHost ? '/host/requests' : '/agency/requests';
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request(endpoint);
      setRows(data.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }, [endpoint, request]);

  useEffect(() => { load(); }, [load]);

  const review = async (userId, status) => {
    const reason = status === 'rejected' ? window.prompt('Reason for rejection?') || '' : '';
    await request(`${reviewEndpoint}/${userId}`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
    load();
  };

  return (
    <Panel error={error} onRefresh={load}>
      <div className="cardsList">
        {rows.map(row => (
          <article className="requestCard" key={row._id}>
            <div><strong>{row.name}</strong><small>{row.email}<br />ID {row.glixId || shortId(row._id)}</small></div>
            <div className="requestMeta">
              {isHost ? (
                <>
                  <span>{row.hostRegistration?.hostType || 'Host request'}</span>
                  <span>{row.hostRegistration?.phoneCountryCode} {row.hostRegistration?.phoneNumber}</span>
                </>
              ) : (
                <>
                  <span>{row.agencyRegistration?.agencyName || row.name}</span>
                  <span>Code: {row.agencyRegistration?.requestedAgencyCode || row.agencyCode || '-'}</span>
                </>
              )}
            </div>
            <div className="rowActions">
              <button onClick={() => review(row._id, 'rejected')}>Reject</button>
              <button className="primary" onClick={() => review(row._id, 'approved')}>Approve</button>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <EmptyState>No pending requests.</EmptyState>}
    </Panel>
  );
}

function AccessRequests({ request }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request(`/admin/access/requests?status=${status}`);
      setRows(data.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request, status]);

  useEffect(() => { load(); }, [load]);

  const review = async (user, nextStatus) => {
    const requestedRole = user.adminAccessRequest?.requestedRole || 'super_admin';
    const reason = nextStatus === 'rejected' ? window.prompt('Reason for rejection?') || '' : '';
    await request(`/admin/access/requests/${user._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus, role: requestedRole, reason }),
    });
    load();
  };

  return (
    <Panel error={error} onRefresh={load} actions={<select value={status} onChange={(e) => setStatus(e.target.value)}>{['pending', 'approved', 'rejected', 'all'].map(item => <option key={item}>{item}</option>)}</select>}>
      <div className="cardsList">
        {rows.map(row => (
          <article className="requestCard" key={row._id}>
            <div>
              <strong>{row.name}</strong>
              <small>{row.email}<br />ID {row.glixId || shortId(row._id)}</small>
            </div>
            <div className="requestMeta">
              <span>Requested role: {row.adminAccessRequest?.requestedRole || '-'}</span>
              <span>Status: {row.adminAccessRequest?.status || 'none'}</span>
              <span>Requested: {niceDate(row.adminAccessRequest?.requestedAt)}</span>
              {row.adminAccessRequest?.note && <span>Note: {row.adminAccessRequest.note}</span>}
              {row.adminAccessRequest?.rejectionReason && <span>Reason: {row.adminAccessRequest.rejectionReason}</span>}
            </div>
            <div className="rowActions">
              {row.adminAccessRequest?.status === 'pending' ? (
                <>
                  <button onClick={() => review(row, 'rejected')}>Reject</button>
                  <button className="primary" onClick={() => review(row, 'approved')}>Approve</button>
                </>
              ) : (
                <StatusBadge value={row.role} />
              )}
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <EmptyState>No access requests.</EmptyState>}
    </Panel>
  );
}
function Withdrawals({ request }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request(`/admin/withdrawals?status=${status}`);
      setRows(data.withdrawals || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request, status]);

  useEffect(() => { load(); }, [load]);

  const review = async (id, nextStatus) => {
    const reason = nextStatus === 'rejected' ? window.prompt('Reason?') || '' : '';
    await request(`/admin/withdrawals/${id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, reason }) });
    load();
  };

  return (
    <Panel error={error} onRefresh={load} actions={<select value={status} onChange={(e) => setStatus(e.target.value)}>{['pending', 'approved', 'rejected'].map(item => <option key={item}>{item}</option>)}</select>}>
      <table>
        <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th /></tr></thead>
        <tbody>
          {rows.map(item => (
            <tr key={item._id}>
              <td><strong>{item.userId?.name || 'User'}</strong><small>{item.userId?.glixId}</small></td>
              <td>{money(item.amount)}<small>{item.source}</small></td>
              <td>{item.method}<small>{item.accountTitle}<br />{item.accountNumber}</small></td>
              <td><StatusBadge value={item.status} /></td>
              <td>{niceDate(item.createdAt)}</td>
              <td>{item.status === 'pending' && <div className="rowActions"><button onClick={() => review(item._id, 'rejected')}>Reject</button><button className="primary" onClick={() => review(item._id, 'approved')}>Approve</button></div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState />}
    </Panel>
  );
}

function Agencies({ request }) {
  const [agencies, setAgencies] = useState([]);
  const [error, setError] = useState('');
  const [assign, setAssign] = useState({ identifier: '', agencyCode: '' });

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request('/admin/agencies');
      setAgencies(data.agencies || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    await request('/admin/agencies', { method: 'POST', body: JSON.stringify(assign) });
    setAssign({ identifier: '', agencyCode: '' });
    load();
  };

  return (
    <Panel error={error} onRefresh={load}>
      <form className="inlineForm" onSubmit={submit}>
        <input placeholder="Email or Glix ID" value={assign.identifier} onChange={(e) => setAssign({ ...assign, identifier: e.target.value })} />
        <input placeholder="Agency code" value={assign.agencyCode} onChange={(e) => setAssign({ ...assign, agencyCode: e.target.value })} />
        <button className="primary">Assign Agency</button>
      </form>
      <table>
        <thead><tr><th>Agency</th><th>Code</th><th>Hosts</th><th>Coins</th><th>Commission</th></tr></thead>
        <tbody>{agencies.map(item => <tr key={item._id}><td><strong>{item.name}</strong><small>{item.email}</small></td><td>{item.agencyCode}</td><td>{item.hostsCount}</td><td>{money(item.totalHostCoins)}</td><td>{money(item.commissionBalance)}</td></tr>)}</tbody>
      </table>
      {!agencies.length && <EmptyState />}
    </Panel>
  );
}

const emptyStoreItem = {
  itemKey: '', name: '', category: 'Popular', section: 'New This Month', type: 'frame', price: 0,
  currency: 'chang', durationDays: 30, imageUrl: '', previewUrl: '', assetKey: '', equipValue: '', isActive: true, sortOrder: 0,
};

function Store({ request }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request('/admin/store/items');
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const save = async (item) => {
    const isNew = !item._id;
    await request(isNew ? '/admin/store/items' : `/admin/store/items/${item._id}`, {
      method: isNew ? 'POST' : 'PATCH',
      body: JSON.stringify(item),
    });
    setEditing(null);
    load();
  };

  return (
    <Panel error={error} onRefresh={load} actions={<button className="primary" onClick={() => setEditing(emptyStoreItem)}>New Item</button>}>
      <table>
        <thead><tr><th>Item</th><th>Category</th><th>Type</th><th>Price</th><th>Status</th><th /></tr></thead>
        <tbody>
          {items.map(item => <tr key={item._id}><td><strong>{item.name}</strong><small>{item.itemKey}</small></td><td>{item.category}<small>{item.section}</small></td><td>{item.type}</td><td>{money(item.price)} {item.currency}</td><td><StatusBadge value={item.isActive ? 'active' : 'suspended'} /></td><td><button onClick={() => setEditing(item)}>Edit</button></td></tr>)}
        </tbody>
      </table>
      {!items.length && <EmptyState />}
      {editing && <StoreModal item={editing} onClose={() => setEditing(null)} onSave={save} />}
    </Panel>
  );
}

function StoreModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  return (
    <div className="modalBackdrop">
      <form className="modal wide" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <h3>{form._id ? 'Edit Store Item' : 'New Store Item'}</h3>
        <div className="formGrid">
          {['itemKey', 'name', 'category', 'section', 'type', 'assetKey', 'equipValue', 'imageUrl', 'previewUrl'].map(key => <label key={key}>{key}<input value={form[key] || ''} onChange={(e) => set(key, e.target.value)} /></label>)}
          <label>price<input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
          <label>durationDays<input type="number" value={form.durationDays} onChange={(e) => set('durationDays', e.target.value)} /></label>
          <label>sortOrder<input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></label>
          <label>currency<select value={form.currency} onChange={(e) => set('currency', e.target.value)}><option>chang</option><option>daimon</option></select></label>
          <label>active<select value={String(form.isActive)} onChange={(e) => set('isActive', e.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select></label>
        </div>
        <div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save</button></div>
      </form>
    </div>
  );
}

function CoinSellers({ request }) {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request(`/admin/coin-seller/requests?status=${status}`);
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request, status]);

  useEffect(() => { load(); }, [load]);

  const review = async (userId, nextStatus) => {
    const reason = nextStatus === 'rejected' ? window.prompt('Reason for rejection?') || '' : '';
    await request(`/admin/coin-seller/requests/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus, reason }),
    });
    load();
  };

  const actions = (
    <select value={status} onChange={(e) => setStatus(e.target.value)}>
      {['all', 'pending', 'approved', 'rejected', 'suspended'].map(item => <option key={item}>{item}</option>)}
    </select>
  );

  return (
    <Panel error={error} onRefresh={load} actions={actions}>
      <div className="cardsList">
        {requests.map(row => {
          const rowStatus = row.coinSellerStatus && row.coinSellerStatus !== 'none'
            ? row.coinSellerStatus
            : row.coinSellerRegistration?.status || 'none';
          return (
            <article className="requestCard" key={row._id}>
              <div>
                <strong>{row.name}</strong>
                <small>{row.email}<br />ID {row.glixId || shortId(row._id)}</small>
              </div>
              <div className="requestMeta">
                <span>Status: {rowStatus}</span>
                <span>Phone: {row.coinSellerRegistration?.phoneNumber || '-'}</span>
                <span>City: {row.coinSellerRegistration?.city || '-'}</span>
                <span>Method: {row.coinSellerRegistration?.paymentMethod || '-'}</span>
                {row.coinSellerRegistration?.note && <span>Note: {row.coinSellerRegistration.note}</span>}
                {row.coinSellerRejectionReason && <span>Reason: {row.coinSellerRejectionReason}</span>}
              </div>
              <div className="rowActions">
                {rowStatus === 'pending' ? (
                  <>
                    <button onClick={() => review(row._id, 'rejected')}>Reject</button>
                    <button className="primary" onClick={() => review(row._id, 'approved')}>Approve</button>
                  </>
                ) : rowStatus === 'approved' ? (
                  <button onClick={() => review(row._id, 'suspended')}>Suspend</button>
                ) : rowStatus === 'suspended' ? (
                  <button className="primary" onClick={() => review(row._id, 'approved')}>Reactivate</button>
                ) : (
                  <StatusBadge value={rowStatus} />
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!requests.length && <EmptyState>No coin seller requests.</EmptyState>}
    </Panel>
  );
}

function SellerBalances({ request }) {
  const [sellers, setSellers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await request('/admin/coin-sellers');
      setSellers(data.sellers || []);
    } catch (err) {
      setError(err.message);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const updateBalance = async (sellerId, type) => {
    const rawAmount = window.prompt(type === 'deduct' ? 'Coins to deduct from seller?' : 'Coins to assign to seller?');
    const amount = Math.floor(Number(rawAmount));
    if (!Number.isFinite(amount) || amount <= 0) return;

    setError('');
    setNotice('');
    try {
      await request(`/admin/coin-sellers/${sellerId}/balance`, {
        method: 'PATCH',
        body: JSON.stringify({ amount, type }),
      });
      setNotice(type === 'deduct' ? 'Seller coins deducted.' : 'Seller coins assigned.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Panel error={error} onRefresh={load}>
      {notice && <div className="successBox">{notice}</div>}
      <table>
        <thead><tr><th>Seller</th><th>Status</th><th>Available Balance</th><th>Total Sold</th><th>Contact</th><th /></tr></thead>
        <tbody>
          {sellers.map(seller => (
            <tr key={seller._id}>
              <td><strong>{seller.name}</strong><small>{seller.email}<br />{seller.glixId || shortId(seller._id)}</small></td>
              <td><StatusBadge value={seller.coinSellerStatus} /></td>
              <td>{money(seller.sellerBalance)}</td>
              <td>{money(seller.sellerTotalSold)}</td>
              <td>{seller.coinSellerRegistration?.phoneNumber || '-'}<small>{seller.coinSellerRegistration?.paymentMethod || ''}</small></td>
              <td>
                <div className="rowActions">
                  <button onClick={() => updateBalance(seller._id, 'deduct')}>Deduct</button>
                  <button className="primary" onClick={() => updateBalance(seller._id, 'add')}>Assign Coins</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sellers.length && <EmptyState>No approved or suspended coin sellers.</EmptyState>}
    </Panel>
  );
}

function MonthlyCommissions({ request }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ sourceCoins: 0, commissionAmount: 0 });
  const [status, setStatus] = useState('all');
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const query = new URLSearchParams({ status });
      if (month.trim()) query.set('month', month.trim());
      const data = await request(`/admin/monthly-commissions?${query.toString()}`);
      setRows(data.commissions || []);
      setTotals(data.totals || { sourceCoins: 0, commissionAmount: 0 });
    } catch (err) {
      setError(err.message);
    }
  }, [month, request, status]);

  useEffect(() => { load(); }, [load]);

  const actions = (
    <>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        {['all', 'pending', 'settled'].map(item => <option key={item}>{item}</option>)}
      </select>
      <input placeholder="YYYY-MM" value={month} onChange={(e) => setMonth(e.target.value)} />
    </>
  );

  return (
    <Panel error={error} onRefresh={load} actions={actions}>
      <div className="successBox">Coins: {money(totals.sourceCoins)} | Commission: {money(totals.commissionAmount)}</div>
      <table>
        <thead><tr><th>Month</th><th>Agency</th><th>Host</th><th>Coins</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row._id}>
              <td>{row.month}</td>
              <td><strong>{row.beneficiaryId?.name || 'Agency'}</strong><small>{row.beneficiaryId?.agencyCode || row.beneficiaryId?.glixId || shortId(row.beneficiaryId?._id)}</small></td>
              <td><strong>{row.hostId?.name || 'Host'}</strong><small>{row.hostId?.glixId || shortId(row.hostId?._id)}</small></td>
              <td>{money(row.sourceCoins)}</td>
              <td>{row.ratePercent || 0}%</td>
              <td>{money(row.commissionAmount)}</td>
              <td><StatusBadge value={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState>No monthly commission records.</EmptyState>}
    </Panel>
  );
}
function Notifications({ request }) {
  const [form, setForm] = useState({ target: 'all', title: 'Glix Live', body: '', userIds: '' });
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setResult('');
    try {
      const payload = { ...form, userIds: form.userIds.split(',').map(item => item.trim()).filter(Boolean) };
      const data = await request('/admin/notifications/send', { method: 'POST', body: JSON.stringify(payload) });
      const skippedReasons = Object.entries(data.skippedReasons || {})
        .map(([reason, count]) => `${reason}: ${count}`)
        .join(', ');
      setResult([
        `Matched users: ${data.matchedUsers ?? 0}`,
        `FCM tokens: ${data.tokenCount ?? 0}`,
        `Delivered: ${data.successCount ?? data.sentTo ?? 0}`,
        `Failed: ${data.failureCount ?? 0}`,
        `Skipped users: ${data.skippedUsers ?? 0}`,
        skippedReasons ? `Reasons: ${skippedReasons}` : '',
      ].filter(Boolean).join(' | '));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Panel error={error}>
      {result && <div className="successBox">{result}</div>}
      <form className="formPanel" onSubmit={submit}>
        <label>Target<select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="all">All users</option><option value="hosts">Approved hosts</option><option value="selected">Selected user IDs</option></select></label>
        {form.target === 'selected' && <label>User IDs, comma separated<textarea value={form.userIds} onChange={(e) => setForm({ ...form, userIds: e.target.value })} /></label>}
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Body<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label>
        <button className="primary">Send Notification</button>
      </form>
    </Panel>
  );
}


function OfficialOnly({ setSession }) {
  return (
    <Panel>
      <div className="empty">
        Official Portal is restricted to the Super Admin only.
        <br />
        <button
          className="primary"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setSession(null);
          }}
          style={{ marginTop: 16 }}
        >
          Sign out
        </button>
      </div>
    </Panel>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  });
  const [active, setActive] = useState('dashboard');
  const { request } = useAdminApi(session, setSession);

  const current = useMemo(() => {
    if (!session) return null;
    const role = session.user?.role;
    if (role !== 'super_admin') return <OfficialOnly setSession={setSession} />;
    if (active === 'users') return <Users request={request} />;
    if (active === 'hosts') return <Requests request={request} type="hosts" />;
    if (active === 'agencies') return <Agencies request={request} />;
    if (active === 'agencyRequests') return <Requests request={request} type="agencies" />;
    if (active === 'withdrawals') return <Withdrawals request={request} />;
    if (active === 'store') return <Store request={request} />;
    if (active === 'notifications') return <Notifications request={request} />;
    if (active === 'accessRequests') return <AccessRequests request={request} />;
    if (active === 'coinSellers') return <CoinSellers request={request} />;
    if (active === 'sellerBalances') return <SellerBalances request={request} />;
    if (active === 'monthlyCommissions') return <MonthlyCommissions request={request} />;
    return <Dashboard request={request} />;
  }, [active, request, session]);

  if (!session) return <Login onLogin={setSession} />;

  return (
    <Shell session={session} setSession={setSession} active={active} setActive={setActive}>
      {current}
    </Shell>
  );
}

createRoot(document.getElementById('root')).render(<App />);










