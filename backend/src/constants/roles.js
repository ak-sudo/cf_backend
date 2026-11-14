const ROLES = Object.freeze({
  CITIZEN: 'CITIZEN',
  ADMIN: 'ADMIN',
  WORKER: 'WORKER',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

const DEPARTMENTS = Object.freeze([
  'SANITATION',
  'ROADS',
  'ELECTRICITY',
  'WATER_SUPPLY',
  'PUBLIC_WORKS',
  'TRAFFIC_INFRASTRUCTURE',
  'GENERAL',
]);

module.exports = {
  ROLES,
  DEPARTMENTS,
};
