import { useState, useEffect, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [teamMember, setTeamMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadContext = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      // Find team membership
      const members = await base44.entities.TeamMember.filter({ user_email: user.email, status: 'active' });
      
      if (members.length > 0) {
        const member = members[0];
        setTeamMember(member);
        // Load company
        const companies = await base44.entities.Company.filter({ id: member.company_id });
        if (companies.length > 0) {
          setCompany(companies[0]);
        }
        // company stays null if not found — triggers onboarding
      } else {
        // Check if user owns a company
        const ownedCompanies = await base44.entities.Company.filter({ owner_email: user.email });
        if (ownedCompanies.length > 0) {
          setCompany(ownedCompanies[0]);
          // Create owner team member record if missing
          const existingMember = await base44.entities.TeamMember.filter({ 
            company_id: ownedCompanies[0].id, 
            user_email: user.email 
          });
          if (existingMember.length === 0) {
            const newMember = await base44.entities.TeamMember.create({
              company_id: ownedCompanies[0].id,
              user_email: user.email,
              user_name: user.full_name,
              role: 'owner',
              status: 'active'
            });
            setTeamMember(newMember);
          } else {
            setTeamMember(existingMember[0]);
          }
        }
        // if no owned company either, company stays null — triggers onboarding
      }
    } catch (e) {
      console.error('Error loading company context:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const refreshContext = () => {
    setLoading(true);
    loadContext();
  };

  const userRole = teamMember?.role || null;
  const canApprove = userRole === 'owner' || userRole === 'manager';
  const canUpload = userRole === 'owner' || userRole === 'manager' || userRole === 'staff';
  const canExport = userRole === 'owner' || userRole === 'manager' || userRole === 'accountant';
  const canManageTeam = userRole === 'owner' || userRole === 'manager';

  return (
    <CompanyContext.Provider value={{
      company, setCompany, teamMember, userRole, loading,
      canApprove, canUpload, canExport, canManageTeam,
      refreshContext
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}