// Public Gallery + Investor Leads domain types

export type PublicGalleryProject = {
  id: string;
  projectId: string;
  isPublic: boolean;
  featured: boolean;
  title: string | null;
  description: string | null;
  coverImageUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InvestorLead = {
  id: string;
  galleryProjectId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  createdAt: string;
};

export type GalleryProjectWithLeads = PublicGalleryProject & {
  leads: InvestorLead[];
};

export type GalleryOwnerContext = {
  userId: string;
  projectId: string;
};

export type GalleryPublishInput = GalleryOwnerContext & {
  isPublic: boolean;
  title?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
};
