import { HostOrgIcon } from "@/config/hostOrg";

export function ReferralGeneratorHeader() {
  return (
    <div>
      <div className="flex items-center gap-4 m-3">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg p-2">
          <HostOrgIcon
            className="w-8 h-8 text-blue-800"
            aria-hidden="true"
            focusable="false"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Find Resources</h2>
          <p className="text-blue-600 font-medium">Referral Generator</p>
        </div>
      </div>
    </div>
  );
}
