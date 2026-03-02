import { prisma } from "./db.js";

export const increaseUserLoyaltyPoints = async (userId: string, amount: number): Promise<void> => {
  if (amount <= 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      loyaltyPoints: {
        increment: amount
      }
    }
  });
};

export const decreaseUserLoyaltyPoints = async (userId: string, amount: number): Promise<void> => {
  if (amount <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loyaltyPoints: true }
  });

  if (!user) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      loyaltyPoints: Math.max(0, user.loyaltyPoints - amount)
    }
  });
};

export const setUserLoyaltyPoints = async (userId: string, points: number): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      loyaltyPoints: Math.max(0, points)
    }
  });
};
