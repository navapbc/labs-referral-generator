"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  MapPin,
  FileText,
  Upload,
  Sparkles,
  Heart,
  Briefcase,
  Home,
  Utensils,
  Car,
  Stethoscope,
  Baby,
  DollarSign,
  GraduationCap,
  Scale,
  Shield,
  Accessibility,
  Flag,
  Menu,
  Grid3X3,
  ChevronDown,
  Star,
  UserPlus,
  Settings,
  ClipboardList,
  ArrowLeft,
  MoreHorizontal,
  Building,
  Users,
} from "lucide-react";

const resourceCategories = [
  {
    id: "employment",
    label: "Employment & Job Training",
    icon: Briefcase,
    color: "bg-blue-100 text-blue-800",
  },
  {
    id: "housing",
    label: "Housing & Shelter",
    icon: Home,
    color: "bg-green-100 text-green-800",
  },
  {
    id: "food",
    label: "Food Assistance",
    icon: Utensils,
    color: "bg-orange-100 text-orange-800",
  },
  {
    id: "transportation",
    label: "Transportation",
    icon: Car,
    color: "bg-purple-100 text-purple-800",
  },
  {
    id: "healthcare",
    label: "Healthcare & Mental Health",
    icon: Stethoscope,
    color: "bg-red-100 text-red-800",
  },
  {
    id: "childcare",
    label: "Childcare",
    icon: Baby,
    color: "bg-pink-100 text-pink-800",
  },
  {
    id: "financial",
    label: "Financial Assistance",
    icon: DollarSign,
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    id: "education",
    label: "Education & GED",
    icon: GraduationCap,
    color: "bg-indigo-100 text-indigo-800",
  },
  {
    id: "legal",
    label: "Legal Services",
    icon: Scale,
    color: "bg-gray-100 text-gray-800",
  },
  {
    id: "substance",
    label: "Substance Use & Treatment",
    icon: Shield,
    color: "bg-teal-100 text-teal-800",
  },
  {
    id: "disability",
    label: "Disability Services",
    icon: Accessibility,
    color: "bg-cyan-100 text-cyan-800",
  },
  {
    id: "veterans",
    label: "Veterans Services",
    icon: Flag,
    color: "bg-emerald-100 text-emerald-800",
  },
];

export default function TestPage() {
  const [clientDescription, setClientDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [zipCode, setZipCode] = useState("");
  const [locationText, setLocationText] = useState("");
  const [activeTab, setActiveTab] = useState("text-summary");
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(
    [],
  );

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setZipCode("");
    setLocationText("");
    setSelectedResourceTypes([]);
  };

  const toggleResourceType = (type: string) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Header */}
      <div className="bg-blue-600 text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-blue-700"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">CW</span>
              </div>
              <span className="font-semibold text-lg">CaseWorthy</span>
            </div>
            <div className="bg-blue-700 px-3 py-1 rounded text-sm font-medium">
              CASE MANAGEMENT
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-blue-700"
            >
              <Grid3X3 className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-white text-blue-600 text-sm font-semibold">
                  RH
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">Ryan Hansz</div>
                <div className="text-blue-200 text-xs">Auditor</div>
              </div>
              <ChevronDown className="w-4 h-4 text-blue-200" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-800 text-white flex flex-col">
          {/* Client Info */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-blue-600 text-white">
                  TC
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">Test Client </h3>
                <div className="text-gray-400 text-sm flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  03/14/2000
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Client ID: 26513</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-700 gap-3"
              >
                <Star className="w-4 h-4" />
                Favorites
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-700 gap-3"
              >
                <Search className="w-4 h-4" />
                Find Client
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-700 gap-3"
              >
                <UserPlus className="w-4 h-4" />
                Add Client
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-700 gap-3"
              >
                <Settings className="w-4 h-4" />
                Case Management
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-gray-700 gap-3"
              >
                <ClipboardList className="w-4 h-4" />
                Assessments
              </Button>
            </div>
          </nav>

          {/* Training Environment Badge */}
          <div className="p-4">
            <div className="bg-white text-black px-3 py-2 rounded text-xs font-bold text-center">
              <div>TRAINING</div>
              <div>ENVIRONMENT</div>
              <div className="text-gray-600 font-normal mt-1">
                Version: 8.0.143.1
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Content Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:bg-gray-100"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="text-gray-400">...</div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Dashboard
                </h1>
              </div>
              <Button
                variant="outline"
                className="text-orange-600 border-orange-600 hover:bg-orange-50 bg-transparent"
              >
                <MoreHorizontal className="w-4 h-4 mr-2" />
                PAGE OPTIONS
              </Button>
            </div>
          </div>

          {/* Main Content Area - Referral Generator */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="border-2 border-gray-300 rounded-lg p-6 bg-white min-h-full">
              {/* Referral Generator Content */}
              <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Heart className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          Find Resources{" "}
                        </h2>
                        <p className="text-blue-600 font-medium">
                          Referral Generator
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <ClipboardList className="w-4 h-4" />
                      View History
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mb-6"
                >
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                    <TabsTrigger
                      value="text-summary"
                      className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600"
                    >
                      <Sparkles className="w-4 h-4" />
                      Text Summary
                    </TabsTrigger>
                    <TabsTrigger
                      value="upload-forms"
                      className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Forms
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Text Summary Tab Content */}
                <div className="space-y-6">
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-4 space-y-4">
                      {/* Resource Categories */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Focus on Specific Resource Types
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {resourceCategories.map((category) => {
                            const Icon = category.icon;
                            const isSelected = selectedCategories.includes(
                              category.id,
                            );
                            return (
                              <Button
                                key={category.id}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                className={`text-sm flex-col justify-center px-0 h-20 ${
                                  isSelected
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                }`}
                                onClick={() => toggleCategory(category.id)}
                              >
                                <Icon className="mr-2 size-2.5 w-6 h-6" />
                                {category.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <Building className="w-4 h-4 text-blue-600" />
                          Resource Provider Types
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Button
                            variant={
                              selectedResourceTypes.includes("internal")
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            className={`h-12 ${
                              selectedResourceTypes.includes("internal")
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                            onClick={() => toggleResourceType("internal")}
                          >
                            <Heart className="w-4 h-4 mr-2" />
                            Internal
                          </Button>
                          <Button
                            variant={
                              selectedResourceTypes.includes("government")
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            className={`h-12 ${
                              selectedResourceTypes.includes("government")
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                            onClick={() => toggleResourceType("government")}
                          >
                            <Building className="w-4 h-4 mr-2" />
                            Government
                          </Button>
                          <Button
                            variant={
                              selectedResourceTypes.includes("community")
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            className={`h-12 ${
                              selectedResourceTypes.includes("community")
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                            onClick={() => toggleResourceType("community")}
                          >
                            <Users className="w-4 h-4 mr-2" />
                            Community
                          </Button>
                        </div>
                      </div>

                      {/* Location Filters */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          Location Preferences
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Enter ZIP Code"
                            value={zipCode}
                            onChange={(e) => setZipCode(e.target.value)}
                            className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <Input
                            placeholder="Enter location (city, area, etc.)"
                            value={locationText}
                            onChange={(e) => setLocationText(e.target.value)}
                            className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Clear All Button */}
                      {(selectedCategories.length > 0 ||
                        selectedResourceTypes.length > 0 ||
                        zipCode ||
                        locationText) && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAllFilters}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Clear All Filters
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900">
                      Client Description (filters automatically added above)
                    </label>
                    <Textarea
                      placeholder="The filters above will automatically be added to your prompt. Add additional details about the client's specific situation, needs, and circumstances here..."
                      value={clientDescription}
                      onChange={(e) => setClientDescription(e.target.value)}
                      className="min-h-[200px] text-base border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <button
                    disabled={!clientDescription.trim()}
                    style={{
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      padding: "12px 32px",
                      fontSize: "18px",
                      fontWeight: "500",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow:
                        "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                      transition: "all 0.2s ease-in-out",
                      opacity: !clientDescription.trim() ? 0.5 : 1,
                    }}
                  >
                    <Sparkles className="w-5 h-5" />
                    Find Resources
                  </button>
                </div>

                {/* Empty State */}
                <div className="mt-12 text-center">
                  <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Search className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
