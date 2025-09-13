import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Lead from '../models/Lead.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lead-management');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Lead.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 12);
    const testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@leadmanager.com',
      password: hashedPassword
    });
    console.log('👤 Created test user');

    // Generate 150 dummy leads
    const sources = ['website', 'facebook_ads', 'google_ads', 'referral', 'events', 'other'];
    const statuses = ['new', 'contacted', 'qualified', 'lost', 'won'];
    const companies = [
      'TechCorp Inc', 'DataSoft Solutions', 'CloudNext', 'InnovateLab', 'DigitalEdge',
      'SmartSystems', 'FutureWorks', 'TechVision', 'CodeCraft', 'WebFlow Co',
      'AppBuilders', 'DevStudio', 'SystemsPlus', 'NetWorks Inc', 'DataDriven',
      'CloudFirst', 'TechStream', 'DigitalCore', 'InnovateTech', 'SmartCode'
    ];
    const cities = [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
      'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
      'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis',
      'Seattle', 'Denver', 'Washington'
    ];
    const states = [
      'NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA', 'TX', 'FL',
      'TX', 'OH', 'NC', 'CA', 'IN', 'WA', 'CO', 'DC'
    ];

    const firstNames = [
      'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica',
      'William', 'Ashley', 'James', 'Amanda', 'Christopher', 'Stephanie', 'Daniel',
      'Melissa', 'Matthew', 'Nicole', 'Anthony', 'Elizabeth', 'Mark', 'Helen',
      'Donald', 'Kimberly', 'Steven', 'Donna', 'Paul', 'Carol', 'Andrew', 'Ruth'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
      'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
    ];

    const leads = [];
    for (let i = 0; i < 150; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
      const phone = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      const company = companies[Math.floor(Math.random() * companies.length)];
      const cityIndex = Math.floor(Math.random() * cities.length);
      const city = cities[cityIndex];
      const state = states[cityIndex];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const score = Math.floor(Math.random() * 101);
      const leadValue = Math.floor(Math.random() * 100000) + 1000;
      const isQualified = Math.random() > 0.7; // 30% qualified
      
      // Random date within last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const createdAt = new Date(sixMonthsAgo.getTime() + Math.random() * (Date.now() - sixMonthsAgo.getTime()));
      
      // 70% chance of having last activity
      const lastActivityAt = Math.random() > 0.3 ? 
        new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime())) : 
        null;

      leads.push({
        firstName,
        lastName,
        email,
        phone,
        company,
        city,
        state,
        source,
        status,
        score,
        leadValue,
        lastActivityAt,
        isQualified,
        createdBy: testUser._id,
        createdAt,
        updatedAt: createdAt
      });
    }

    await Lead.insertMany(leads);
    console.log('📊 Created 150 dummy leads');

    console.log('\n🎉 Database seeded successfully!');
    console.log('📧 Test user credentials:');
    console.log('   Email: test@leadmanager.com');
    console.log('   Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();