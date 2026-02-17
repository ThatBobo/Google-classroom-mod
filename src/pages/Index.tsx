import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Dashboard />;
};

export default Index;
