-- The client's HR data as the skills see it (fictional company). Pay is per calendar year.
CREATE SCHEMA IF NOT EXISTS hr;

CREATE TABLE IF NOT EXISTS hr.entities (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL CHECK (country IN ('DE', 'PT')),
  currency text NOT NULL,
  full_time_hours integer NOT NULL CHECK (full_time_hours > 0)
);

CREATE TABLE IF NOT EXISTS hr.employees (
  id text PRIMARY KEY,
  entity text NOT NULL REFERENCES hr.entities(id),
  gender text NOT NULL CHECK (gender IN ('F', 'M', 'X')),
  family text NOT NULL,
  level text NOT NULL CHECK (level IN ('L1','L2','L3','L4','L5','L6')),
  location text NOT NULL,
  org_unit text NOT NULL,
  manager_id text REFERENCES hr.employees(id) DEFERRABLE INITIALLY DEFERRED,
  fte numeric(4,2) NOT NULL CHECK (fte > 0 AND fte <= 1),
  hire_date date NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS hr.pay (
  employee_id text NOT NULL REFERENCES hr.employees(id),
  year integer NOT NULL,
  base numeric(12,2) NOT NULL CHECK (base >= 0),
  complementary numeric(12,2) NOT NULL CHECK (complementary >= 0),
  variable numeric(12,2) NOT NULL CHECK (variable >= 0),
  hours_paid integer NOT NULL CHECK (hours_paid > 0),
  PRIMARY KEY (employee_id, year)
);

CREATE TABLE IF NOT EXISTS hr.merit_proposals (
  employee_id text NOT NULL REFERENCES hr.employees(id),
  cycle text NOT NULL,
  proposed_pct numeric(5,2) NOT NULL,
  reason text NOT NULL DEFAULT '',
  proposed_by text NOT NULL,
  PRIMARY KEY (employee_id, cycle)
);
