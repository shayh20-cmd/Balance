import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import AddTransaction from './screens/AddTransaction';
import CloseMonth from './screens/CloseMonth';
import Funds from './screens/Funds';
import Home from './screens/Home';
import Recurring from './screens/Recurring';
import Review from './screens/Review';
import Settings from './screens/Settings';
import Transactions from './screens/Transactions';

const tabs = [
  { to: '/', label: 'בית' },
  { to: '/tx', label: 'עסקאות' },
  { to: '/recurring', label: 'קבועות' },
  { to: '/funds', label: 'קופות' },
  { to: '/settings', label: 'הגדרות' },
];

export default function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tx" element={<Transactions />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/tx/:id" element={<AddTransaction />} />
        <Route path="/recurring" element={<Recurring />} />
        <Route path="/funds" element={<Funds />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/close/:month" element={<CloseMonth />} />
        <Route path="/review" element={<Review />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
