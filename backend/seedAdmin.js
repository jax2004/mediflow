import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';

const email = 'admin@mediflow.com';

await mongoose.connect(process.env.MONGO_URI);

if (await User.findOne({ email })) {
  console.log('Admin already exists');
} else {
  await User.create({
    name: 'Admin',
    email,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
  });
  console.log('Admin created:', email);
}

await mongoose.disconnect();