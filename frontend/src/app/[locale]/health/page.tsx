import { getApiDomain } from "@/src/util/apiDomain";

export default async function Page() {
  return <>Healthy, API domain: {await getApiDomain()}</>;
}
