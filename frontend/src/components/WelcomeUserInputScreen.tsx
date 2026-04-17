import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { HostOrgIcon } from "@/config/hostOrg";

type WelcomeUserInputScreenType = {
  setUserName: (name: string) => void;
  setUserEmail: (email: string) => void;
};

const WelcomeUserInputScreen = ({
  setUserName,
  setUserEmail,
}: WelcomeUserInputScreenType) => {
  const [userNameInput, setUserNameInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [userEmailError, setUserEmailError] = useState("");
  const [userEmailTouched, setUserEmailTouched] = useState(false);

  // Simple email validation
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Validate user email and set error message
  const validateUserEmail = (email: string) => {
    if (!email.trim()) {
      setUserEmailError("Email is required");
      return false;
    }
    if (!isValidEmail(email)) {
      setUserEmailError("Please enter a valid email address");
      return false;
    }
    setUserEmailError("");
    return true;
  };

  // Handle user email blur to show validation errors
  const handleUserEmailBlur = () => {
    setUserEmailTouched(true);
    validateUserEmail(userEmailInput);
  };

  // Handle user email change and clear error if valid
  const handleUserEmailChange = (email: string) => {
    setUserEmailInput(email);
    // If email was touched and user is now typing, validate in real-time
    if (userEmailTouched) {
      validateUserEmail(email);
    }
  };

  const handleUserInfoSubmit = () => {
    if (
      userNameInput.trim() &&
      userEmailInput.trim() &&
      isValidEmail(userEmailInput)
    ) {
      localStorage.setItem("userName", userNameInput.trim());
      localStorage.setItem("userEmail", userEmailInput.trim());
      setUserName(userNameInput.trim());
      setUserEmail(userEmailInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center">
              <HostOrgIcon
                className="h-20 w-20 text-blue-800"
                aria-hidden="true"
                focusable="false"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to the Referral Generator
            </h1>
            <p className="text-gray-600 text-base">
              To help us understand how this tool is being used and make
              improvements, please provide your name and email.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="userName"
                className="text-sm font-medium text-gray-700"
              >
                Your Name *
              </Label>
              <Input
                id="userName"
                name="userName"
                type="text"
                placeholder="Enter your full name"
                value={userNameInput}
                onChange={(e) => setUserNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    userNameInput.trim() &&
                    userEmailInput.trim() &&
                    isValidEmail(userEmailInput)
                  ) {
                    handleUserInfoSubmit();
                  }
                }}
                autoComplete="off"
                data-form-type="other"
                className="w-full bg-white focus-visible:ring-blue-600 focus-visible:ring-offset-0 focus-visible:border-blue-600"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="userEmail"
                className="text-sm font-medium text-gray-700"
              >
                Your Email *
              </Label>
              <Input
                id="userEmail"
                name="userEmail"
                type="email"
                placeholder="Enter your email address"
                value={userEmailInput}
                onChange={(e) => handleUserEmailChange(e.target.value)}
                onBlur={handleUserEmailBlur}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    userNameInput.trim() &&
                    userEmailInput.trim() &&
                    isValidEmail(userEmailInput)
                  ) {
                    handleUserInfoSubmit();
                  }
                }}
                autoComplete="off"
                data-form-type="other"
                className={`w-full bg-white focus-visible:ring-offset-0 ${
                  userEmailTouched && userEmailError
                    ? "border-red-600 focus-visible:ring-red-600 focus-visible:border-red-600"
                    : "focus-visible:ring-blue-600 focus-visible:border-blue-600"
                }`}
              />
              {userEmailTouched && userEmailError && (
                <p className="text-sm text-red-600 mt-1">{userEmailError}</p>
              )}
            </div>

            <Button
              onClick={handleUserInfoSubmit}
              disabled={
                !userNameInput.trim() ||
                !userEmailInput.trim() ||
                !isValidEmail(userEmailInput)
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-semibold"
            >
              Get Started
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WelcomeUserInputScreen;
