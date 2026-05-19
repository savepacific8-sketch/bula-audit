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
        // Ensure current_company_id is set on the user for RLS to work
        if (!user.data?.current_company_id || user.data.current_company_id !== member.company_id) {
          await base44.auth.updateMe({
            current_company_id: member.company_id,
            current_company_role: member.role,
          });
          // Re-fetch user so RLS token reflects the new company context
          await base44.auth.me();
        }
        // Load company — RLS allows read if current_company_id matches or owner_email matches
        const ownedCompanies = await base44.entities.Company.filter({ owner_email: user.email });
        const found = ownedCompanies.find(c => c.id === member.company_id);
        if (found) {
          setCompany(found);
        } else {
          // Try listing all accessible companies (covers non-owner members via RLS)
          const allCompanies = await base44.entities.Company.list();
          const match = allCompanies.find(c => c.id === member.company_id);
          if (match) setCompany(match);
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
    setCompany(null);
    setTeamMember(null);
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