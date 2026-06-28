// src/services/therapist.service.ts
export const getTherapists = async (filters: any) => {
  return await Therapist.find(filters)
    .select('-__v')
    .lean() // Returns plain JS objects instead of Mongoose documents
    .exec();
};