export type TradesJobInterestStatus = "pending" | "accepted" | "rejected";

export type TradesJobInterest = {
  id: string;
  jobId: string;
  userId: string;
  message: string | null;
  status: TradesJobInterestStatus;
  createdAt: string;
};

export type CreateTradesJobInterestInput = {
  jobId: string;
  message?: string;
};
