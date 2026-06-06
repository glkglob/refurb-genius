"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Textarea } from "@repo/ui";
import { Label } from "@repo/ui";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";

interface LeadCaptureFormProps {
  galleryProjectId: string;
  projectTitle?: string;
}

export function LeadCaptureForm({ galleryProjectId, projectTitle }: LeadCaptureFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hp) {
      // Spam bot filled the honeypot
      toast.error("Submission blocked.");
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast.error("Please provide your name and email.");
      return;
    }

    // Simple client rate limit (demo)
    const lastSubmit = localStorage.getItem("lastGalleryLead");
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 30000) {
      toast.error("Please wait before submitting another inquiry.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("investor_leads").insert({
        gallery_project_id: galleryProjectId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        message:
          message.trim() || `Interest in ${projectTitle || "this project"} via public gallery.`,
      });

      if (error) throw error;

      localStorage.setItem("lastGalleryLead", Date.now().toString());

      toast.success("Inquiry sent!", {
        description: "Thank you. A member of the team will contact you shortly.",
      });

      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setHp("");
    } catch (err: unknown) {
      logger.error("[gallery] lead submit failed", {
        error: (err as Error)?.message,
        galleryProjectId,
      });
      toast.error("Failed to send inquiry. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot - hidden from real users */}
      <input
        type="text"
        name="website"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div>
        <Label htmlFor="message">Message / Interest (optional)</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`I'm interested in learning more about ${projectTitle || "this opportunity"}...`}
          rows={3}
          disabled={submitting}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting || !name || !email}>
        {submitting ? "Sending..." : "Send Inquiry"}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        Your details will only be shared with the project owner. We respect your privacy.
      </p>
    </form>
  );
}
