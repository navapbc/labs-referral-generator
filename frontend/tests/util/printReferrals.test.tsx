import { render, screen } from "tests/react-utils";
import { PrintableReferralsReport } from "@/util/printReferrals";
import { Resource } from "@/types/resources";
import { ActionPlan } from "@/util/fetchActionPlan";

describe("PrintableReferralsReport", () => {
  const mockResources: Resource[] = [
    {
      name: "Food Bank of Central Texas",
      addresses: ["6500 Metropolis Dr, Austin, TX 78744"],
      phones: ["(512) 684-2550"],
      emails: ["info@centraltexasfoodbank.org"],
      website: "https://www.centraltexasfoodbank.org",
      description: "Provides food assistance to families in need",
      justification: "Client needs food assistance",
    },
    {
      name: "Austin Community Health Center",
      addresses: [
        "123 Main St, Austin, TX 78701",
        "456 Oak Ave, Austin, TX 78702",
      ],
      phones: ["(512) 555-1234", "(512) 555-5678"],
      emails: ["contact@austinhealth.org", "info@austinhealth.org"],
      website: "https://www.austinhealth.org",
      description: "Affordable healthcare services for low-income families",
      justification: "Client needs healthcare access",
    },
  ];

  const sampleActionPlan: ActionPlan = {
    title: "Expunge your record after fulfilling probation requirements",
    summary:
      "Having a clean record will help you in your job application process.",
    content:
      "### Project RIO\\n**How to apply:**\\n- Call the Project RIO line and ask for the Austin office: 1-800-453-8140. ([hrw.org](https://www.hrw.org/news/2010/07/20/texas-prison-resources?utm_source=openai))\\n- Visit or mail to the TWC Project RIO office at 101 East 15th Street, Room 506-T, Austin, TX 78778 to set an intake appointment. ([hrw.org](https://www.hrw.org/news/2010/07/20/texas-prison-resources?utm_source=openai))\\n\\n**Documents needed:**\\n- Photo ID (state ID or driver’s license)\\n- Proof of release/parole papers or probation completion\\n- Social Security card or number\\n- Recent resume or list of past jobs (if available)\\n\\n**Timeline:**\\n- First appointment often same week to 2 weeks.\\n\\n**Key tip:**\\n- Tell staff you are eligible for employer incentives (Work Opportunity Tax Credit). Project RIO staff can connect you to employers and note hiring incentives. ([ojp.gov](https://www.ojp.gov/ncjrs/virtual-library/abstracts/project-rio-procedures-and-reporting-manual?utm_source=openai))\\n",
  };

  it("displays the header with organization name", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    expect(screen.getByText("Your Resource Guide")).toBeInTheDocument();
    expect(
      screen.getByText("Personalized resources selected for you"),
    ).toBeInTheDocument();
  });

  it("displays the date in the header", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    // Date is now displayed in a compact format (e.g., "1/29/2026 at 2:05:07 PM")
    expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeInTheDocument();
  });

  it("displays all resources from the array", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    mockResources.forEach((resource) => {
      expect(screen.getByText(resource.name)).toBeInTheDocument();
    });
  });

  it("displays resource descriptions", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    mockResources.forEach((resource) => {
      // @ts-expect-error resources will be populated in this test
      expect(screen.getByText(resource.description)).toBeInTheDocument();
    });
  });

  it("displays resource addresses", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    mockResources.forEach((resource) => {
      resource.addresses?.forEach((address) => {
        // @ts-expect-error addresses will be populated in this test
        expect(screen.getByText(new RegExp(address))).toBeInTheDocument();
      });
    });
  });

  it("displays resource emails", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    mockResources.forEach((resource) => {
      resource.emails?.forEach((email) => {
        // @ts-expect-error emails will be populated in this test
        expect(screen.getByText(new RegExp(email))).toBeInTheDocument();
      });
    });
  });

  it("displays resource websites", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    mockResources.forEach((resource) => {
      expect(
        // @ts-expect-error website will be populated in this test
        screen.getByText(new RegExp(resource.website)),
      ).toBeInTheDocument();
    });
  });

  it("displays 'No resources found' when array is empty", () => {
    render(
      <PrintableReferralsReport
        resources={[]}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    expect(screen.getByText("No resources found.")).toBeInTheDocument();
  });

  it("displays footer text", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    expect(
      screen.getByText("Report generated by Referral Generator"),
    ).toBeInTheDocument();
  });

  it("displays action plan when provided", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
        actionPlan={sampleActionPlan}
      />,
    );

    expect(screen.getByText(sampleActionPlan.title)).toBeInTheDocument();
    expect(screen.getByText(sampleActionPlan.summary)).toBeInTheDocument();
  });

  it("does not display action plan section when actionPlan is null", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
        actionPlan={null}
      />,
    );

    expect(screen.queryByText(sampleActionPlan.title)).not.toBeInTheDocument();
  });

  it("does not display action plan section when actionPlan is undefined", () => {
    render(
      <PrintableReferralsReport
        resources={mockResources}
        clientDescription={"client needs help accessing classes"}
      />,
    );

    expect(screen.queryByText(sampleActionPlan.title)).not.toBeInTheDocument();
  });

  describe("print mode variations", () => {
    it("displays action plan subtitle when printMode is action-plan-only", () => {
      render(
        <PrintableReferralsReport
          resources={mockResources}
          clientDescription={"client needs help"}
          actionPlan={sampleActionPlan}
          printMode="action-plan-only"
          selectedResources={mockResources}
        />,
      );

      expect(
        screen.getByText("Personalized action plan and resources"),
      ).toBeInTheDocument();
    });

    it("displays resources subtitle when printMode is full-referrals", () => {
      render(
        <PrintableReferralsReport
          resources={mockResources}
          clientDescription={"client needs help"}
          actionPlan={sampleActionPlan}
          printMode="full-referrals"
        />,
      );

      expect(
        screen.getByText("Personalized resources selected for you"),
      ).toBeInTheDocument();
    });

    it("shows compact resource list in action-plan-only mode", () => {
      render(
        <PrintableReferralsReport
          resources={mockResources}
          clientDescription={"client needs help"}
          actionPlan={sampleActionPlan}
          printMode="action-plan-only"
          selectedResources={mockResources}
        />,
      );

      // CompactResourceList should show "Selected Resources - Contact Information"
      expect(
        screen.getByText("Selected Resources - Contact Information"),
      ).toBeInTheDocument();
    });

    it("does not show resource descriptions in action-plan-only mode", () => {
      render(
        <PrintableReferralsReport
          resources={mockResources}
          clientDescription={"client needs help"}
          actionPlan={sampleActionPlan}
          printMode="action-plan-only"
          selectedResources={mockResources}
        />,
      );

      // Descriptions should not appear in compact mode
      expect(
        screen.queryByText("Provides food assistance to families in need"),
      ).not.toBeInTheDocument();
    });

    it("shows full resource details in full-referrals mode", () => {
      render(
        <PrintableReferralsReport
          resources={mockResources}
          clientDescription={"client needs help"}
          actionPlan={sampleActionPlan}
          printMode="full-referrals"
        />,
      );

      // Descriptions should appear in full mode
      expect(
        screen.getByText("Provides food assistance to families in need"),
      ).toBeInTheDocument();
    });

    it("shows action plan in action-plan-only mode", () => {
      render(
        <PrintableReferralsReport
          resources={mockResources}
          clientDescription={"client needs help"}
          actionPlan={sampleActionPlan}
          printMode="action-plan-only"
          selectedResources={mockResources}
        />,
      );

      expect(screen.getByText(sampleActionPlan.title)).toBeInTheDocument();
      expect(screen.getByText(sampleActionPlan.summary)).toBeInTheDocument();
    });
  });
});
