"use client";

import React, { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { emailResponses } from "@/util/emailResponses";
import { ShareOptionsDialog, ShareMode } from "./ShareOptionsDialog";

interface EmailReferralsProps {
  resultId: string;
  actionPlanResultId?: string;
  requestorEmail: string;
  excludedResourceNames?: string[];
  disabled?: boolean;
}

export function EmailReferralsButton({
  resultId,
  actionPlanResultId,
  requestorEmail,
  excludedResourceNames = [],
  disabled = false,
}: EmailReferralsProps) {
  const [recipientEmail, setRecipientEmail] = useState(requestorEmail);
  const [showModeOptions, setShowModeOptions] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ShareMode | undefined>(
    undefined,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const hasActionPlan = !!actionPlanResultId;

  const isValidEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleEmailButtonClick = () => {
    // If action plan exists, show mode selection first
    if (hasActionPlan) {
      setShowModeOptions(true);
    } else {
      // No action plan, go directly to email input (mode remains undefined for resources-only)
      setIsEmailDialogOpen(true);
    }
  };

  const handleModeSelect = (mode: ShareMode) => {
    setSelectedMode(mode);
    setShowModeOptions(false);
    setIsEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    setIsLoading(true);
    setStatusMessage("");

    try {
      const { emailAddr } = await emailResponses(
        resultId,
        actionPlanResultId,
        recipientEmail,
        requestorEmail,
        selectedMode,
        excludedResourceNames,
      );

      setEmailSent(true);
      setStatusMessage(`Email sent successfully to ${emailAddr}`);
    } catch (error) {
      console.error("Error sending email:", error);
      setStatusMessage(
        "There was an error sending the email, please try again later.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmailSent(false);
    setStatusMessage("");
    setRecipientEmail(requestorEmail);
    setSelectedMode(undefined);
  };

  const handleEmailDialogChange = (open: boolean) => {
    setIsEmailDialogOpen(open);
    if (!open) {
      handleClose();
    }
  };

  // Determine dialog title and description based on selected mode
  const getDialogContent = () => {
    if (selectedMode === "action-plan-only") {
      return {
        title: "Email Action Plan",
        description:
          "Your email is pre-filled below. Change it to send to someone else. Includes the personalized action plan with next steps.",
      };
    } else if (hasActionPlan) {
      return {
        title: "Email Resources and Action Plan",
        description:
          "Your email is pre-filled below. Change it to send to someone else. Includes the selected resources and personalized action plan with next steps.",
      };
    } else {
      return {
        title: "Email Resources",
        description:
          "Your email is pre-filled below. Change it to send to someone else. Includes the selected resources with descriptions and contact information.",
      };
    }
  };

  const dialogContent = getDialogContent();

  return (
    <>
      {/* Mode selection dialog - reuses ShareOptionsDialog */}
      <ShareOptionsDialog
        open={showModeOptions}
        onOpenChange={setShowModeOptions}
        onSelectMode={handleModeSelect}
        hasActionPlan={hasActionPlan}
        variant="email"
      />

      {/* Email input dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={handleEmailDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription className="text-base">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                data-testid="emailInput"
                className={
                  recipientEmail && !isValidEmail(recipientEmail)
                    ? "border-red-600 focus:border-red-600 focus:ring-red-600"
                    : ""
                }
              />
              {recipientEmail && !isValidEmail(recipientEmail) && (
                <p className="text-sm text-red-600">
                  Please enter a valid email address
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <div className="w-full space-y-2">
              <div className="flex gap-2 justify-end">
                <DialogClose asChild>
                  <Button
                    className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100 hover:text-gray-900 cursor-pointer disabled:!cursor-not-allowed"
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    variant="outline"
                    data-testid="cancelEmailButton"
                  >
                    {emailSent ? "Close" : "Cancel"}
                  </Button>
                </DialogClose>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:cursor-not-allowed"
                  type="submit"
                  onClick={() => void handleSendEmail()}
                  disabled={
                    isLoading ||
                    !recipientEmail.trim() ||
                    !isValidEmail(recipientEmail)
                  }
                  data-testid="sendEmailButton"
                >
                  {isLoading ? "Sending..." : "Send Email"}
                </Button>
              </div>
              {statusMessage && (
                <p
                  className={`text-sm ${
                    statusMessage.includes("error sending the email")
                      ? "text-red-600"
                      : "text-green-900"
                  }`}
                >
                  {statusMessage}
                </p>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email button trigger */}
      <Button
        variant="outline"
        className="text-gray-900 border-gray-400 hover:bg-gray-100 hover:text-gray-900"
        data-testid="emailReferralsButton"
        disabled={disabled}
        onClick={handleEmailButtonClick}
      >
        <Mail className="w-4 h-4" />
        Email
      </Button>
    </>
  );
}
