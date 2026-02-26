import React from 'react';
import DataAdmin from './DataAdmin';

const SuperManageDataAdmin: React.FC = () => {
  // DataAdmin already restricts access to superadmin only
  return <DataAdmin />;
};

export default SuperManageDataAdmin;
