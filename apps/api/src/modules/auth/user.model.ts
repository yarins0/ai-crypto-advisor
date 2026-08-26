import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

/** Shape of a persisted user document. */
export interface UserAttributes {
  email: string;
  name: string;
  passwordHash: string;
  onboardedAt: Date | null;
  isDemo: boolean;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    // Omitted from every query result by default (Mongoose `select: false`), so
    // returning a user document can never leak the hash by accident — a caller
    // must opt in explicitly with `.select('+passwordHash')` to see it.
    passwordHash: { type: String, required: true, select: false },
    onboardedAt: { type: Date, default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// The `unique: true` above is enforced by MongoDB itself, not application
// code: two simultaneous registrations for the same address cannot both
// succeed. A "check then insert" in application code would leave a race
// window between the two; an index has none.
export const UserModel = mongoose.model<UserAttributes>('User', userSchema);
