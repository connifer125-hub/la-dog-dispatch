-- LA Dog Dispatch Database Schema

-- Users table (for all user types)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'rescue', 'foster', 'donor', 'transporter', 'vet', 'walker', 'social'
  phone VARCHAR(20),
  address TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rescue organizations (vetted rescues)
CREATE TABLE IF NOT EXISTS rescues (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR(255) NOT NULL,
  ein_tax_id VARCHAR(20),
  rescue_type VARCHAR(100),
  capacity INTEGER DEFAULT 0,
  service_area TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dogs table
CREATE TABLE IF NOT EXISTS dogs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  breed VARCHAR(255),
  age VARCHAR(50),
  gender VARCHAR(20),
  shelter VARCHAR(255),
  shelter_id VARCHAR(100),
  deadline DATE,
  photo_url TEXT,
  description TEXT,
  source VARCHAR(50), -- 'petharbor', 'manual'
  category VARCHAR(50), -- 'medical', 'ice', 'death', 'general'
  status VARCHAR(50) DEFAULT 'urgent', -- 'urgent', 'funded', 'rescued', 'adopted'
  goal_amount DECIMAL(10,2) DEFAULT 500.00,
  raised_amount DECIMAL(10,2) DEFAULT 0.00,
  petharbor_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL,
  donor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50), -- 'stripe', 'venmo', 'paypal', 'zelle', 'cashapp'
  payment_id VARCHAR(255),
  is_recurring BOOLEAN DEFAULT FALSE,
  donor_email VARCHAR(255),
  donor_name VARCHAR(255),
  anonymous BOOLEAN DEFAULT FALSE,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rescue assignments (when a rescue takes a dog)
CREATE TABLE IF NOT EXISTS rescue_assignments (
  id SERIAL PRIMARY KEY,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
  rescue_id INTEGER REFERENCES rescues(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'cancelled'
  pickup_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foster applications
CREATE TABLE IF NOT EXISTS foster_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  home_type VARCHAR(100),
  yard_fenced BOOLEAN,
  other_pets TEXT,
  experience_level VARCHAR(50),
  availability TEXT,
  max_dog_size VARCHAR(50),
  special_needs_ok BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transport requests
CREATE TABLE IF NOT EXISTS transport_requests (
  id SERIAL PRIMARY KEY,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  transport_date DATE,
  transporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'needed', -- 'needed', 'claimed', 'completed'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical needs
CREATE TABLE IF NOT EXISTS medical_needs (
  id SERIAL PRIMARY KEY,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
  vet_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  procedure_needed TEXT,
  estimated_cost DECIMAL(10,2),
  urgency VARCHAR(50), -- 'critical', 'high', 'medium', 'low'
  status VARCHAR(50) DEFAULT 'needed', -- 'needed', 'scheduled', 'completed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications/Updates
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  dog_id INTEGER REFERENCES dogs(id) ON DELETE CASCADE,
  type VARCHAR(50), -- 'dog_added', 'goal_reached', 'dog_rescued', 'transport_needed'
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email subscribers (for alerts)
CREATE TABLE IF NOT EXISTS email_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  categories TEXT[], -- array of categories they want alerts for
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dogs_status ON dogs(status);
CREATE INDEX IF NOT EXISTS idx_dogs_deadline ON dogs(deadline);
CREATE INDEX IF NOT EXISTS idx_dogs_category ON dogs(category);
CREATE INDEX IF NOT EXISTS idx_donations_dog_id ON donations(dog_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
