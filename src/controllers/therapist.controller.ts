import { Response, Request } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Therapist } from '../models/Therapist';
import { ApiError } from '../utils/ApiError';

/**
 * Map a Therapist document into the camelCase JSON contract the frontend
 * expects. We keep the underlying schema fields in snake_case for legacy
 * reasons but always serialize them to camelCase on the way out.
 */
const serialize = (t: any) => ({
  id: t._id,
  firstName: t.first_name,
  lastName: t.last_name,
  email: t.email,
  specializations: t.specializations,
  bio: t.bio,
  experienceYears: t.experience_years,
  rating: t.rating,
  availability: t.availability,
  profileImage: t.profile_image,
});

/**
 * GET /therapists/search?q={query}
 * Must be declared BEFORE GET /:id
 */
export const searchTherapists = async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(StatusCodes.OK).json({ success: true, data: [] });
    return;
  }
  const regex = new RegExp(q, 'i');
  const therapists = await Therapist.find({
    $or: [
      { first_name: regex },
      { last_name: regex },
      { specializations: regex },
      { bio: regex },
    ],
  }).lean();
  res.status(StatusCodes.OK).json({ success: true, data: therapists.map(serialize) });
};

/**
 * GET /therapists/filter
 * Must be declared BEFORE GET /:id
 */
export const filterTherapists = async (req: Request, res: Response) => {
  const { specialization, minRating, availability } = req.query;
  const filter: any = {};
  if (specialization) filter.specializations = String(specialization);
  if (minRating) filter.rating = { $gte: Number(minRating) };
  if (typeof availability !== 'undefined') {
    filter.availability = String(availability) === 'true';
  }
  const therapists = await Therapist.find(filter).lean();
  res.status(StatusCodes.OK).json({ success: true, data: therapists.map(serialize) });
};

/**
 * GET /therapists
 */
export const getAllTherapists = async (_req: Request, res: Response) => {
  const therapists = await Therapist.find().lean();
  res.status(StatusCodes.OK).json({ success: true, data: therapists.map(serialize) });
};

/**
 * GET /therapists/:id
 */
export const getTherapistById = async (req: Request, res: Response) => {
  const therapist = await Therapist.findById(req.params.id).lean();
  if (!therapist) throw ApiError.notFound('Therapist not found');
  res.status(StatusCodes.OK).json({ success: true, data: serialize(therapist) });
};
