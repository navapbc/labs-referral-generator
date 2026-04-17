import { Resource } from "@/types/resources";
import { MapPin, Phone, Globe, Mail } from "lucide-react";

interface CompactResourceListProps {
  resources: Resource[];
}

/**
 * A compact list of resources showing only contact information (no descriptions).
 * Used in the "Action Plan Only" print mode to provide reference info for selected resources.
 */
export function CompactResourceList({ resources }: CompactResourceListProps) {
  if (resources.length === 0) return null;

  return (
    <section className="mt-6" aria-labelledby="compact-resources-heading">
      <h3
        id="compact-resources-heading"
        className="text-base font-semibold text-gray-900 mb-3"
      >
        Selected Resources - Contact Information
      </h3>
      <ol className="space-y-3 list-none p-0 m-0">
        {resources.map((resource, index) => (
          <li
            key={resource.name}
            className="border border-gray-300 rounded-lg p-3 bg-white"
          >
            <article className="flex items-start gap-2">
              <span
                className="text-sm font-medium text-gray-700 min-w-[20px]"
                aria-hidden="true"
              >
                {index + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {resource.name}
                </h4>
                <dl className="mt-1 space-y-1 text-sm text-gray-700">
                  {resource.addresses && resource.addresses.length > 0 && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Address</dt>
                      <MapPin
                        className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-600"
                        aria-hidden="true"
                      />
                      <dd>{resource.addresses.filter(Boolean).join(" | ")}</dd>
                    </div>
                  )}
                  {resource.phones && resource.phones.length > 0 && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Phone</dt>
                      <Phone
                        className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-600"
                        aria-hidden="true"
                      />
                      <dd>{resource.phones.filter(Boolean).join(" | ")}</dd>
                    </div>
                  )}
                  {resource.website && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Website</dt>
                      <Globe
                        className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-600"
                        aria-hidden="true"
                      />
                      <dd>
                        <a
                          href={resource.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline hover:text-blue-800 break-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        >
                          {resource.website}
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                      </dd>
                    </div>
                  )}
                  {resource.emails && resource.emails.length > 0 && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Email</dt>
                      <Mail
                        className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-600"
                        aria-hidden="true"
                      />
                      <dd>{resource.emails.filter(Boolean).join(" | ")}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
