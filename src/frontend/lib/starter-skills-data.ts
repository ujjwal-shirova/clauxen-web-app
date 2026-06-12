export interface FileItem {
  name: string;
  type: "file" | "folder";
  children?: FileItem[];
}

// Match real skill-repo paths: hidden dirs, hyphen-prefixed slugs, Python modules.
const STARTER_SKILL_SEGMENT_PATTERN =
  /^(?:\.?[a-zA-Z0-9][a-zA-Z0-9._-]*|-[a-zA-Z0-9][a-zA-Z0-9._-]*|__[a-zA-Z0-9_]+__(?:\.[a-zA-Z0-9_]+)*)$/;

function assertStarterSkillTreeNames(
  items: readonly FileItem[],
  parentPath = "",
): void {
  for (const item of items) {
    const { name } = item;
    if (
      !name ||
      name === "." ||
      name === ".." ||
      name.includes("/") ||
      name.includes("\\") ||
      !STARTER_SKILL_SEGMENT_PATTERN.test(name)
    ) {
      throw new Error(
        `Invalid starter skill tree segment: ${parentPath ? `${parentPath}/${name}` : name}`,
      );
    }
    if (item.children?.length) {
      assertStarterSkillTreeNames(
        item.children,
        parentPath ? `${parentPath}/${name}` : name,
      );
    }
  }
}

function deepFreeze<T extends object>(value: T): T {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child as object);
    }
  }
  return value;
}

const starterSkillsStructureData: FileItem[] = [
  {
    name: "accessibility-wcag",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "adaptyv",
    type: "folder",
    children: [
      {
        name: "reference",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "examples.md", type: "file" },
          { name: "experiments.md", type: "file" },
          { name: "protein_optimization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "aeon",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "anomaly_detection.md", type: "file" },
          { name: "classification.md", type: "file" },
          { name: "clustering.md", type: "file" },
          { name: "datasets_benchmarking.md", type: "file" },
          { name: "distances.md", type: "file" },
          { name: "forecasting.md", type: "file" },
          { name: "networks.md", type: "file" },
          { name: "regression.md", type: "file" },
          { name: "segmentation.md", type: "file" },
          { name: "similarity_search.md", type: "file" },
          { name: "transformations.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "algorithmic-art",
    type: "folder",
    children: [
      {
        name: "templates",
        type: "folder",
        children: [
          { name: "generator_template.js", type: "file" },
          { name: "viewer.html", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "alphafold-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "alpha-vantage",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "commodities.md", type: "file" },
          { name: "economic-indicators.md", type: "file" },
          { name: "forex-crypto.md", type: "file" },
          { name: "fundamentals.md", type: "file" },
          { name: "intelligence.md", type: "file" },
          { name: "options.md", type: "file" },
          { name: "technical-indicators.md", type: "file" },
          { name: "time-series.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "anndata",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "best_practices.md", type: "file" },
          { name: "concatenation.md", type: "file" },
          { name: "data_structure.md", type: "file" },
          { name: "io_operations.md", type: "file" },
          { name: "manipulation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "api-design-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "arboreto",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "algorithms.md", type: "file" },
          { name: "basic_inference.md", type: "file" },
          { name: "distributed_computing.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "basic_grn_inference.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "artifacts-builder",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "bundle-artifact.sh", type: "file" },
          { name: "init-artifact.sh", type: "file" },
          { name: "shadcn-components.tar.gz", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "arxiv-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "arxiv_search.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "astropy",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "coordinates.md", type: "file" },
          { name: "cosmology.md", type: "file" },
          { name: "fits.md", type: "file" },
          { name: "tables.md", type: "file" },
          { name: "time.md", type: "file" },
          { name: "units.md", type: "file" },
          { name: "wcs_and_other_modules.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "authentication-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "aws-cloud-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "benchling-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_endpoints.md", type: "file" },
          { name: "authentication.md", type: "file" },
          { name: "sdk_reference.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "bgpt-paper-search",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "bindingdb-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "affinity_queries.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "biopython",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced.md", type: "file" },
          { name: "alignment.md", type: "file" },
          { name: "blast.md", type: "file" },
          { name: "databases.md", type: "file" },
          { name: "phylogenetics.md", type: "file" },
          { name: "sequence_io.md", type: "file" },
          { name: "structure.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "biorxiv-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "biorxiv_search.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "bioservices",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "identifier_mapping.md", type: "file" },
          { name: "services_reference.md", type: "file" },
          { name: "workflow_patterns.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "batch_id_converter.py", type: "file" },
          { name: "compound_cross_reference.py", type: "file" },
          { name: "pathway_analysis.py", type: "file" },
          { name: "protein_analysis_workflow.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "brand-guidelines",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "brenda-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "brenda_queries.py", type: "file" },
          { name: "brenda_visualization.py", type: "file" },
          { name: "enzyme_pathway_builder.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "canvas-design",
    type: "folder",
    children: [
      {
        name: "canvas-fonts",
        type: "folder",
        children: [
          { name: "ArsenalSC-OFL.txt", type: "file" },
          { name: "ArsenalSC-Regular.ttf", type: "file" },
          { name: "BigShoulders-Bold.ttf", type: "file" },
          { name: "BigShoulders-OFL.txt", type: "file" },
          { name: "BigShoulders-Regular.ttf", type: "file" },
          { name: "Boldonse-OFL.txt", type: "file" },
          { name: "Boldonse-Regular.ttf", type: "file" },
          { name: "BricolageGrotesque-Bold.ttf", type: "file" },
          { name: "BricolageGrotesque-OFL.txt", type: "file" },
          { name: "BricolageGrotesque-Regular.ttf", type: "file" },
          { name: "CrimsonPro-Bold.ttf", type: "file" },
          { name: "CrimsonPro-Italic.ttf", type: "file" },
          { name: "CrimsonPro-OFL.txt", type: "file" },
          { name: "CrimsonPro-Regular.ttf", type: "file" },
          { name: "DMMono-OFL.txt", type: "file" },
          { name: "DMMono-Regular.ttf", type: "file" },
          { name: "EricaOne-OFL.txt", type: "file" },
          { name: "EricaOne-Regular.ttf", type: "file" },
          { name: "GeistMono-Bold.ttf", type: "file" },
          { name: "GeistMono-OFL.txt", type: "file" },
          { name: "GeistMono-Regular.ttf", type: "file" },
          { name: "Gloock-OFL.txt", type: "file" },
          { name: "Gloock-Regular.ttf", type: "file" },
          { name: "IBMPlexMono-Bold.ttf", type: "file" },
          { name: "IBMPlexMono-OFL.txt", type: "file" },
          { name: "IBMPlexMono-Regular.ttf", type: "file" },
          { name: "IBMPlexSerif-Bold.ttf", type: "file" },
          { name: "IBMPlexSerif-BoldItalic.ttf", type: "file" },
          { name: "IBMPlexSerif-Italic.ttf", type: "file" },
          { name: "IBMPlexSerif-Regular.ttf", type: "file" },
          { name: "InstrumentSans-Bold.ttf", type: "file" },
          { name: "InstrumentSans-BoldItalic.ttf", type: "file" },
          { name: "InstrumentSans-Italic.ttf", type: "file" },
          { name: "InstrumentSans-OFL.txt", type: "file" },
          { name: "InstrumentSans-Regular.ttf", type: "file" },
          { name: "InstrumentSerif-Italic.ttf", type: "file" },
          { name: "InstrumentSerif-Regular.ttf", type: "file" },
          { name: "Italiana-OFL.txt", type: "file" },
          { name: "Italiana-Regular.ttf", type: "file" },
          { name: "JetBrainsMono-Bold.ttf", type: "file" },
          { name: "JetBrainsMono-OFL.txt", type: "file" },
          { name: "JetBrainsMono-Regular.ttf", type: "file" },
          { name: "Jura-Light.ttf", type: "file" },
          { name: "Jura-Medium.ttf", type: "file" },
          { name: "Jura-OFL.txt", type: "file" },
          { name: "LibreBaskerville-OFL.txt", type: "file" },
          { name: "LibreBaskerville-Regular.ttf", type: "file" },
          { name: "Lora-Bold.ttf", type: "file" },
          { name: "Lora-BoldItalic.ttf", type: "file" },
          { name: "Lora-Italic.ttf", type: "file" },
          { name: "Lora-OFL.txt", type: "file" },
          { name: "Lora-Regular.ttf", type: "file" },
          { name: "NationalPark-Bold.ttf", type: "file" },
          { name: "NationalPark-OFL.txt", type: "file" },
          { name: "NationalPark-Regular.ttf", type: "file" },
          { name: "NothingYouCouldDo-OFL.txt", type: "file" },
          { name: "NothingYouCouldDo-Regular.ttf", type: "file" },
          { name: "Outfit-Bold.ttf", type: "file" },
          { name: "Outfit-OFL.txt", type: "file" },
          { name: "Outfit-Regular.ttf", type: "file" },
          { name: "PixelifySans-Medium.ttf", type: "file" },
          { name: "PixelifySans-OFL.txt", type: "file" },
          { name: "PoiretOne-OFL.txt", type: "file" },
          { name: "PoiretOne-Regular.ttf", type: "file" },
          { name: "RedHatMono-Bold.ttf", type: "file" },
          { name: "RedHatMono-OFL.txt", type: "file" },
          { name: "RedHatMono-Regular.ttf", type: "file" },
          { name: "Silkscreen-OFL.txt", type: "file" },
          { name: "Silkscreen-Regular.ttf", type: "file" },
          { name: "SmoochSans-Medium.ttf", type: "file" },
          { name: "SmoochSans-OFL.txt", type: "file" },
          { name: "Tektur-Medium.ttf", type: "file" },
          { name: "Tektur-OFL.txt", type: "file" },
          { name: "Tektur-Regular.ttf", type: "file" },
          { name: "WorkSans-Bold.ttf", type: "file" },
          { name: "WorkSans-BoldItalic.ttf", type: "file" },
          { name: "WorkSans-Italic.ttf", type: "file" },
          { name: "WorkSans-OFL.txt", type: "file" },
          { name: "WorkSans-Regular.ttf", type: "file" },
          { name: "YoungSerif-OFL.txt", type: "file" },
          { name: "YoungSerif-Regular.ttf", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "cbioportal-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "study_exploration.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "cellxgene-census",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "census_schema.md", type: "file" },
          { name: "common_patterns.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "changelog-generator",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "chembl-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "example_queries.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "ci-cd-pipelines",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "cirq",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "building.md", type: "file" },
          { name: "experiments.md", type: "file" },
          { name: "hardware.md", type: "file" },
          { name: "noise.md", type: "file" },
          { name: "simulation.md", type: "file" },
          { name: "transformation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "citation-management",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "bibtex_template.bib", type: "file" },
          { name: "citation_checklist.md", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "bibtex_formatting.md", type: "file" },
          { name: "citation_validation.md", type: "file" },
          { name: "google_scholar_search.md", type: "file" },
          { name: "metadata_extraction.md", type: "file" },
          { name: "pubmed_search.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "doi_to_bibtex.py", type: "file" },
          { name: "extract_metadata.py", type: "file" },
          { name: "format_bibtex.py", type: "file" },
          { name: "search_google_scholar.py", type: "file" },
          { name: "search_pubmed.py", type: "file" },
          { name: "validate_citations.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "claude-api",
    type: "folder",
    children: [
      {
        name: "csharp",
        type: "folder",
        children: [{ name: "claude-api.md", type: "file" }],
      },
      {
        name: "curl",
        type: "folder",
        children: [{ name: "examples.md", type: "file" }],
      },
      {
        name: "go",
        type: "folder",
        children: [{ name: "claude-api.md", type: "file" }],
      },
      {
        name: "java",
        type: "folder",
        children: [{ name: "claude-api.md", type: "file" }],
      },
      {
        name: "php",
        type: "folder",
        children: [{ name: "claude-api.md", type: "file" }],
      },
      {
        name: "python",
        type: "folder",
        children: [
          {
            name: "agent-sdk",
            type: "folder",
            children: [
              { name: "patterns.md", type: "file" },
              { name: "README.md", type: "file" },
            ],
          },
          {
            name: "claude-api",
            type: "folder",
            children: [
              { name: "batches.md", type: "file" },
              { name: "files-api.md", type: "file" },
              { name: "README.md", type: "file" },
              { name: "streaming.md", type: "file" },
              { name: "tool-use.md", type: "file" },
            ],
          },
        ],
      },
      {
        name: "ruby",
        type: "folder",
        children: [{ name: "claude-api.md", type: "file" }],
      },
      {
        name: "shared",
        type: "folder",
        children: [
          { name: "error-codes.md", type: "file" },
          { name: "live-sources.md", type: "file" },
          { name: "models.md", type: "file" },
          { name: "tool-use-concepts.md", type: "file" },
        ],
      },
      {
        name: "typescript",
        type: "folder",
        children: [
          {
            name: "agent-sdk",
            type: "folder",
            children: [
              { name: "patterns.md", type: "file" },
              { name: "README.md", type: "file" },
            ],
          },
          {
            name: "claude-api",
            type: "folder",
            children: [
              { name: "batches.md", type: "file" },
              { name: "files-api.md", type: "file" },
              { name: "README.md", type: "file" },
              { name: "streaming.md", type: "file" },
              { name: "tool-use.md", type: "file" },
            ],
          },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "clinical-decision-support",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "biomarker_report_template.tex", type: "file" },
          { name: "clinical_pathway_template.tex", type: "file" },
          { name: "cohort_analysis_template.tex", type: "file" },
          { name: "color_schemes.tex", type: "file" },
          { name: "example_gbm_cohort.md", type: "file" },
          { name: "recommendation_strength_guide.md", type: "file" },
          { name: "treatment_recommendation_template.tex", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "biomarker_classification.md", type: "file" },
          { name: "clinical_decision_algorithms.md", type: "file" },
          { name: "evidence_synthesis.md", type: "file" },
          { name: "outcome_analysis.md", type: "file" },
          { name: "patient_cohort_analysis.md", type: "file" },
          { name: "README.md", type: "file" },
          { name: "treatment_recommendations.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "biomarker_classifier.py", type: "file" },
          { name: "build_decision_tree.py", type: "file" },
          { name: "create_cohort_tables.py", type: "file" },
          { name: "generate_survival_analysis.py", type: "file" },
          { name: "validate_cds_document.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "clinical-reports",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "case_report_template.md", type: "file" },
          { name: "clinical_trial_csr_template.md", type: "file" },
          { name: "clinical_trial_sae_template.md", type: "file" },
          { name: "consult_note_template.md", type: "file" },
          { name: "discharge_summary_template.md", type: "file" },
          { name: "hipaa_compliance_checklist.md", type: "file" },
          { name: "history_physical_template.md", type: "file" },
          { name: "lab_report_template.md", type: "file" },
          { name: "pathology_report_template.md", type: "file" },
          { name: "quality_checklist.md", type: "file" },
          { name: "radiology_report_template.md", type: "file" },
          { name: "soap_note_template.md", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "case_report_guidelines.md", type: "file" },
          { name: "clinical_trial_reporting.md", type: "file" },
          { name: "data_presentation.md", type: "file" },
          { name: "diagnostic_reports_standards.md", type: "file" },
          { name: "medical_terminology.md", type: "file" },
          { name: "patient_documentation.md", type: "file" },
          { name: "peer_review_standards.md", type: "file" },
          { name: "README.md", type: "file" },
          { name: "regulatory_compliance.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "check_deidentification.py", type: "file" },
          { name: "compliance_checker.py", type: "file" },
          { name: "extract_clinical_data.py", type: "file" },
          { name: "format_adverse_events.py", type: "file" },
          { name: "generate_report_template.py", type: "file" },
          { name: "terminology_validator.py", type: "file" },
          { name: "validate_case_report.py", type: "file" },
          { name: "validate_trial_report.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "clinicaltrials-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "query_clinicaltrials.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "clinpgx-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "query_clinpgx.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "clinvar-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "clinical_significance.md", type: "file" },
          { name: "data_formats.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "cobrapy",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_quick_reference.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "competitive-ads-extractor",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "composio-skills",
    type: "folder",
    children: [
      {
        name: ".claude-plugin",
        type: "folder",
        children: [{ name: "marketplace.json", type: "file" }],
      },
      {
        name: "-21risk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "-2chat-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ably-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "abstract-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "abuselpdb-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "abyssale-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "accelo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "accredible-certificates-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "acculynx-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "active-campaign-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "addresszen-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "adobe-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "adrapid-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "adyntel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "aero-workflow-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "aeroleads-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "affinda-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "affinity-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "agencyzoom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "agent-mail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "agentql-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "agenty-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "agiled-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "agility-cms-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ahrefs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ai-ml-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "aivoov-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "alchemy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "algodocs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "algolia-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "all-images-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "alpha-vantage-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "altoviz-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "alttext-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "amara-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "amazon-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ambee-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ambient-weather-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "amcards-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "anchor-browser-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "anonyflow-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "anthropic_administrator-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "anthropic-administrator-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apaleo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apex27-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "api2pdf-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "api-bible-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apiflash-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "api-labz-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apilio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "api-ninjas-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apipie-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "api-sports-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apitemplate-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apiverve-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "apollo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "appcircle-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "appdrag-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "appointo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "appsflyer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "appveyor-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "aryn-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ascora-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ashby-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "asin-data-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "astica-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "async-interview-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "atlassian-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "attio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "auth0-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "autobound-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "autom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "axonaut-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ayrshare-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "backendless-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bannerbear-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bart-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "baselinker-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "baserow-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "basin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "battlenet-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "beaconchain-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "beaconstac-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "beamer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "beeminder-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bench-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "benchmark-email-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "benzinga-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bestbuy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "better-proposals-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "better-stack-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bidsketch-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "big-data-cloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bigmailer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bigml-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bigpicture-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bitquery-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bitwarden-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "blackbaud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "blackboard-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "blocknative-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "boldsign-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bolna-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "boloforms-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bolt-iot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bonsai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bookingmood-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "booqable-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "borneo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "botbaba-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "botpress-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "botsonic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "botstar-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bouncer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "boxhero-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "braintree-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "brandfetch-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "breeze-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "breezy-hr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "brex-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "brex-staging-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "brightdata-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "brightpearl-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "brilliant-directories-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "browseai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "browser-tool-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "browserbase-tool-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "browserhub-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "browserless-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "btcpay-server-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bubble-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bugbug-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bugherd-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bugsnag-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "buildkite-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "builtwith-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "bunnycdn-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "byteforms-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cabinpanda-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cal-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "calendarhero-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "callerapi-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "callingly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "callpage-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "campaign-cleaner-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "campayn-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "canny-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "canvas-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "capsule_crm-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "capsule-crm-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "carbone-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cardly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "castingwords-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cats-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cdr-platform-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "census-bureau-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "centralstationcrm-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "certifier-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "chaser-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "chatbotkit-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "chatfai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "chatwork-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "chmeetings-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cincopa-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "claid-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "classmarker-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "clearout-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "clickmeeting-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "clockify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudcart-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudconvert-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudflare-api-key-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudflare-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudflare-browser-rendering-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudinary-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudlayer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cloudpress-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "coassemble-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "codacy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "codeinterpreter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "codereadr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "coinbase-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "coinmarketcal-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "coinmarketcap-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "coinranking-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "college-football-data-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "composio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "composio-search-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "connecteam-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "contentful-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "contentful-graphql-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "control-d-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "conversion-tools-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "convertapi-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "conveyor-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "convolo-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "corrently-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "countdown-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "coupa-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "craftmypdf-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "crowdin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "crustdata-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cults-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "curated-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "currents-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "customerio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "customgpt-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "customjs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "cutt-ly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "d2lbrightspace-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dadata-ru-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "daffy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dailybot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "datagma-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "datarobot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "deadline-funnel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "deel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "deepgram-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "demio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "desktime-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "detrack-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dialmycalls-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dialpad-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dictionary-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "diffbot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "digicert-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "digital-ocean-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "discordbot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dnsfilter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dock-certs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docker_hub-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docker-hub-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docmosis-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docnify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docsbot-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docsumo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docugenerate-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "documenso-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "documint-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docupilot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docupost-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "docuseal-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "doppler-marketing-automation-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "doppler-secretops-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dotsimple-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dovetail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dpd2-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "draftable-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dreamstudio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dripcel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "drip-jobs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dromo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dropbox-sign-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dropcontact-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dungeon-fighter-online-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "dynamics365-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "echtpost-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "elevenlabs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "elorus-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "emailable-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "emaillistverify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "emailoctopus-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "emelia-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "encodian-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "endorsal-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "enginemailer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "enigma-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "entelligence-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "eodhd-apis-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "epic-games-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "esignatures-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "espocrm-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "esputnik-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "etermin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "evenium-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "eventbrite-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "eventee-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "eventzilla-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "everhour-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "eversign-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "exa-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "excel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "exist-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "expofp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "extracta-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "facebook-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "faceup-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "factorial-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "feathery-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "felt-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fibery-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fidel-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "files-com-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fillout_forms-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fillout-forms-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "finage-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "findymail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "finerworks-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fingertip-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "finmei-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fireberry-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "firecrawl-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fireflies-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "firmao-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fitbit-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fixer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fixer-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "flexisign-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "flowiseai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "flutterwave-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fluxguard-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "folk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fomo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "forcemanager-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "formbricks-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "formcarry-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "formdesk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "formsite-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "foursquare-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fraudlabs-pro-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "freshbooks-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "front-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "fullenrich-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gagelist-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gamma-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gan-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gatherup-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gemini-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gender-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "genderapi-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "genderize-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "geoapify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "geocodio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "geokeo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "getform-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gift-up-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gigasheet-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "giphy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gist-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "givebutter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gladia-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gleap-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "globalping-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "godial-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gong-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "goodbits-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "goody-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google_admin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google_classroom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google_maps-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google_search_console-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google-address-validation-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google-admin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googleads-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googlebigquery-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googlecalendar-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google-classroom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google-cloud-vision-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googledocs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googledrive-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google-maps-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googlemeet-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googlephotos-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "google-search-console-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googleslides-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googlesuper-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "googletasks-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gorgias-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gosquared-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "go-to-webinar-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "grafbase-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "graphhopper-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "griptape-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "grist-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "groqcloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "gumroad-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "habitica-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hackernews-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "happy-scribe-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "harvest-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hashnode-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "helcim-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "helloleads-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "helpwise-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "here-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "heygen-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "heyreach-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "heyzine-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "highergov-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "highlevel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "honeybadger-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "honeyhive-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hookdeck-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hotspotsystem-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "html-to-image-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "humanitix-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "humanloop-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hunter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hypeauditor-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hyperbrowser-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hyperise-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "hystruct-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "icims-talent-cloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "icypeas-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "idea-scale-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "identitycheck-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ignisign-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "imagekit-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "imgbb-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "imgix-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "influxdb-cloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "insighto-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "instacart-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "instantly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "intelliprint-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "interzoid-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ip2location-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ip2location-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ip2proxy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ip2whois-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ipdata-co-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ipinfo-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "iqair-airvisual-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "jigsawstack-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "jobnimbus-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "jotform-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "jumpcloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "junglescout-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kadoa-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kaggle-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kaleido-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "keap-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "keen-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kickbox-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kit-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "klipfolio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ko-fi-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kommo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kontent-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "kraken-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "l2s-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "labs64-netlicensing-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "landbot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "langbase-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lastpass-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "launch_darkly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "launch-darkly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "leadfeeder-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "leadoku-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "leiga-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lemlist-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lemon_squeezy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lemon-squeezy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lessonspace-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lever-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "leverly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lever-sandbox-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lexoffice-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "linguapop-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "linkhut-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "linkup-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "listclean-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "listennotes-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "livesession-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lmnt-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "lodgify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "logo-dev-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "loomio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "loyverse-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "magnetic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailbluster-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailboxlayer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailcheck-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailcoach-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailerlite-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailersend-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mailsoftly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mails-so-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "maintainx-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "many_chat-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "many-chat-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mapbox-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mapulus-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mboum-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "melo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mem0-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mem-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "memberspot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "memberstack-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "membervault-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "metaads-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "metaphor-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mezmo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "microsoft_clarity-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "microsoft-clarity-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "microsoft-tenant-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "minerstat-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "missive-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mistral_ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mistral-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mocean-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "moco-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "modelry-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "moneybird-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "moonclerk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "moosend-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mopinion-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "more-trees-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "moxie-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "moz-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "msg91-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mural-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mx-technologies-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "mx-toolbox-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "nango-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "nano-nets-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "nasa-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "nasdaq-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ncscale-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "needle-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "neon-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "netsuite-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "neuronwriter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "neutrino-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "neverbounce-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "new_relic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "new-relic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "news-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "nextdns-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ngrok-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ninox-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "nocrm-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "npm-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ocrspace-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ocr-web-service-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "omnisend-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "oncehub-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "onedesk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "onepage-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "onesignal_rest_api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "onesignal-rest-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "onesignal-user-auth-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "openai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "opencage-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "opengraph-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "openperplex-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "openrouter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "open-sea-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "openweather-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "optimoroute-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "owl-protocol-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "page-x-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pandadoc-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "paradym-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "parallel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "parma-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "parsehub-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "parsera-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "parseur-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "passcreator-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "passslot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "payhip-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pdf4me-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pdf-api-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pdf-co-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pdfless-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pdfmonkey-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "peopledatalabs-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "perigon-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "perplexityai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "persistiq-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pexels-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "phantombuster-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "piggy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "piloterr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pilvio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pingdom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pipeline-crm-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "placekey-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "placid-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "plain-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "plasmic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "platerecognizer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "plisio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "polygon-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "polygon-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "poptin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "postgrid-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "postgrid-verify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "precoro-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "prerender-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "printautopilot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "prisma-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "prismic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "process-street-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "procfu-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "productboard-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "productlane-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "project-bubble-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "proofly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "proxiedmail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pushbullet-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "pushover-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "quaderno-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "qualaroo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "quickbooks-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "radar-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rafflys-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ragic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "raisely-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ramp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ravenseotools-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "realphonevalidation-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "re-amaze-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "recallai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "recruitee-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "refiner-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "remarkety-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "remote-retrieval-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "remove-bg-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "renderform-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "repairshopr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "replicate-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "reply-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "reply-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "resend-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "respond-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "retailed-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "retellai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "retently-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rev-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "revolt-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ring_central-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ring-central-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rippling-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ritekit-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rkvst-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rocketlane-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rootly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "rosette-text-analytics-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "route4me-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "safetyculture-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sage-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "salesforce-marketing-cloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "salesforce-service-cloud-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "salesmate-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sap-successfactors-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "satismeter-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "scrape-do-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "scrapegraph-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "scrapfly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "scrapingant-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "scrapingbee-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "screenshot-fyi-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "screenshotone-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "seat-geek-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "securitytrails-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "segmetrics-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "seismic-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "semanticscholar-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "semrush-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sendbird-ai-chabot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sendbird-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sendfox-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sendlane-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sendloop-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sendspark-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sensibo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "seqera-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "serpapi-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "serpdog-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "serply-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "servicem8-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sevdesk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "share_point-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "share-point-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "shipengine-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "shortcut-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "shorten-rest-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "short-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "short-menu-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "shortpixel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "shotstack-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sidetracker-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "signaturely-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "signpath-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "signwell-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "similarweb_digitalrank_api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "similarweb-digitalrank-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "simla-com-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "simple-analytics-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "simplesat-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sitespeakai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "skyfire-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "slackbot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "smartproxy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "smartrecruiters-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sms-alert-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "smtp2go-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "smugmug-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "snowflake-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sourcegraph-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "splitwise-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "spoki-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "spondyr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "spotify-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "spotlightr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sslmate-cert-spotter-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "stack-exchange-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "stannp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "starton-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "statuscake-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "storeganise-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "storerocket-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "stormglass-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "strava-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "streamtime-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "supadata-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "superchat-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "supportbee-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "supportivekoala-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "survey_monkey-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "survey-monkey-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "svix-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "sympla-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "synthflow-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "taggun-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "talenthr-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tally-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tapfiliate-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tapform-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tavily-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "taxjar-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "teamcamp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "telnyx-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "teltel-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "templated-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "test-app-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "textcortex-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "textit-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "textrazor-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "text-to-pdf-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "thanks-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "the-odds-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ticketmaster-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ticktick-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "timecamp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "timekit-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "timelinesai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "timelink-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "timely-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tinyurl-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tisane-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "toggl-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "token-metrics-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tomba-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tomtom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "toneden-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tpscheck-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "triggercmd-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "tripadvisor-content-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "turbot-pipes-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "turso-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "twelve-data-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "twitch-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "twocaptcha-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "typefully-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "typless-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "u301-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "unione-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "updown-io-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "uploadcare-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "uptimerobot-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "userlist-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "v0-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "venly-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "veo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "verifiedemail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "veriphone-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "vero-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "vestaboard-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "virustotal-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "visme-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "waboxapp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wachete-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "waiverfile-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wakatime-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wati-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wave_accounting-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wave-accounting-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "weathermap-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "webex-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "webscraping-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "webvizio-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "whautomate-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "winston-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wit-ai-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wiz-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "wolfram-alpha-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "woodpecker-co-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "workable-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "workday-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "workiom-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "worksnaps-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "writer-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "xero-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "yandex-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "yelp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "y-gy-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "ynab-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "yousearch-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zenrows-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zenserp-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zeplin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zerobounce-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho_bigin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho_books-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho_desk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho_inventory-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho_invoice-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho_mail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-bigin-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-books-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-desk-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-inventory-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-invoice-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoho-mail-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zoominfo-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zylvie-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
      {
        name: "zyte-api-automation",
        type: "folder",
        children: [{ name: "SKILL.md", type: "file" }],
      },
    ],
  },
  {
    name: "connect",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "connect-apps",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "connect-apps-plugin",
    type: "folder",
    children: [
      {
        name: ".claude-plugin",
        type: "folder",
        children: [{ name: "plugin.json", type: "file" }],
      },
      {
        name: "commands",
        type: "folder",
        children: [{ name: "setup.md", type: "file" }],
      },
      { name: "README.md", type: "file" },
    ],
  },
  {
    name: "consciousness-council",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "advanced-configurations.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "content-research-writer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "continuous-learning",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "cosmic-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "cosmic_data_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "download_cosmic.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "dask",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "arrays.md", type: "file" },
          { name: "bags.md", type: "file" },
          { name: "best-practices.md", type: "file" },
          { name: "dataframes.md", type: "file" },
          { name: "futures.md", type: "file" },
          { name: "schedulers.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "database-optimization",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "datacommons-client",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "getting_started.md", type: "file" },
          { name: "node.md", type: "file" },
          { name: "observation.md", type: "file" },
          { name: "resolve.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "data-engineering",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "datamol",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "conformers_module.md", type: "file" },
          { name: "core_api.md", type: "file" },
          { name: "descriptors_viz.md", type: "file" },
          { name: "fragments_scaffolds.md", type: "file" },
          { name: "io_module.md", type: "file" },
          { name: "reactions_data.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "deepchem",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "graph_neural_network.py", type: "file" },
          { name: "predict_solubility.py", type: "file" },
          { name: "transfer_learning.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "deeptools",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: "quick_reference.md", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "effective_genome_sizes.md", type: "file" },
          { name: "normalization_methods.md", type: "file" },
          { name: "tools_reference.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "validate_files.py", type: "file" },
          { name: "workflow_generator.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "denario",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "examples.md", type: "file" },
          { name: "installation.md", type: "file" },
          { name: "llm_configuration.md", type: "file" },
          { name: "research_pipeline.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "depmap",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "dependency_analysis.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "developer-growth-analysis",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "devops-automation",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "dhdna-profiler",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "advanced-profiling.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "diffdock",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "batch_template.csv", type: "file" },
          { name: "custom_inference_config.yaml", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "confidence_and_limitations.md", type: "file" },
          { name: "parameters_reference.md", type: "file" },
          { name: "workflows_examples.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "analyze_results.py", type: "file" },
          { name: "prepare_batch_csv.py", type: "file" },
          { name: "setup_check.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "django-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "dnanexus-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "app-development.md", type: "file" },
          { name: "configuration.md", type: "file" },
          { name: "data-operations.md", type: "file" },
          { name: "job-execution.md", type: "file" },
          { name: "python-sdk.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "doc-coauthoring",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "docker-best-practices",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "document-skills",
    type: "folder",
    children: [
      {
        name: "docx",
        type: "folder",
        children: [
          {
            name: "ooxml",
            type: "folder",
            children: [
              {
                name: "schemas",
                type: "folder",
                children: [
                  {
                    name: "ecma",
                    type: "folder",
                    children: [
                      {
                        name: "fouth-edition",
                        type: "folder",
                        children: [
                          { name: "opc-contentTypes.xsd", type: "file" },
                          { name: "opc-coreProperties.xsd", type: "file" },
                          { name: "opc-digSig.xsd", type: "file" },
                          { name: "opc-relationships.xsd", type: "file" },
                        ],
                      },
                    ],
                  },
                  {
                    name: "ISO-IEC29500-4_2016",
                    type: "folder",
                    children: [
                      { name: "dml-chart.xsd", type: "file" },
                      { name: "dml-chartDrawing.xsd", type: "file" },
                      { name: "dml-diagram.xsd", type: "file" },
                      { name: "dml-lockedCanvas.xsd", type: "file" },
                      { name: "dml-main.xsd", type: "file" },
                      { name: "dml-picture.xsd", type: "file" },
                      { name: "dml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "dml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "pml.xsd", type: "file" },
                      {
                        name: "shared-additionalCharacteristics.xsd",
                        type: "file",
                      },
                      { name: "shared-bibliography.xsd", type: "file" },
                      { name: "shared-commonSimpleTypes.xsd", type: "file" },
                      {
                        name: "shared-customXmlDataProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-customXmlSchemaProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesCustom.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesExtended.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesVariantTypes.xsd",
                        type: "file",
                      },
                      { name: "shared-math.xsd", type: "file" },
                      {
                        name: "shared-relationshipReference.xsd",
                        type: "file",
                      },
                      { name: "sml.xsd", type: "file" },
                      { name: "vml-main.xsd", type: "file" },
                      { name: "vml-officeDrawing.xsd", type: "file" },
                      { name: "vml-presentationDrawing.xsd", type: "file" },
                      { name: "vml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "vml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "wml.xsd", type: "file" },
                      { name: "xml.xsd", type: "file" },
                    ],
                  },
                  {
                    name: "mce",
                    type: "folder",
                    children: [{ name: "mc.xsd", type: "file" }],
                  },
                  {
                    name: "microsoft",
                    type: "folder",
                    children: [
                      { name: "wml-2010.xsd", type: "file" },
                      { name: "wml-2012.xsd", type: "file" },
                      { name: "wml-2018.xsd", type: "file" },
                      { name: "wml-cex-2018.xsd", type: "file" },
                      { name: "wml-cid-2016.xsd", type: "file" },
                      { name: "wml-sdtdatahash-2020.xsd", type: "file" },
                      { name: "wml-symex-2015.xsd", type: "file" },
                    ],
                  },
                ],
              },
              {
                name: "scripts",
                type: "folder",
                children: [
                  {
                    name: "validation",
                    type: "folder",
                    children: [
                      { name: "__init__.py", type: "file" },
                      { name: "base.py", type: "file" },
                      { name: "docx.py", type: "file" },
                      { name: "pptx.py", type: "file" },
                      { name: "redlining.py", type: "file" },
                    ],
                  },
                  { name: "pack.py", type: "file" },
                  { name: "unpack.py", type: "file" },
                  { name: "validate.py", type: "file" },
                ],
              },
            ],
          },
          {
            name: "scripts",
            type: "folder",
            children: [
              {
                name: "templates",
                type: "folder",
                children: [
                  { name: "comments.xml", type: "file" },
                  { name: "commentsExtended.xml", type: "file" },
                  { name: "commentsExtensible.xml", type: "file" },
                  { name: "commentsIds.xml", type: "file" },
                  { name: "people.xml", type: "file" },
                ],
              },
              { name: "__init__.py", type: "file" },
              { name: "document.py", type: "file" },
              { name: "utilities.py", type: "file" },
            ],
          },
          { name: "docx-js.md", type: "file" },
          { name: "ooxml.md", type: "file" },
          { name: "SKILL.md", type: "file" },
        ],
      },
      {
        name: "pdf",
        type: "folder",
        children: [
          {
            name: "scripts",
            type: "folder",
            children: [
              { name: "check_bounding_boxes.py", type: "file" },
              { name: "check_bounding_boxes_test.py", type: "file" },
              { name: "check_fillable_fields.py", type: "file" },
              { name: "convert_pdf_to_images.py", type: "file" },
              { name: "create_validation_image.py", type: "file" },
              { name: "extract_form_field_info.py", type: "file" },
              { name: "fill_fillable_fields.py", type: "file" },
              { name: "fill_pdf_form_with_annotations.py", type: "file" },
            ],
          },
          { name: "forms.md", type: "file" },
          { name: "reference.md", type: "file" },
          { name: "SKILL.md", type: "file" },
        ],
      },
      {
        name: "pptx",
        type: "folder",
        children: [
          {
            name: "ooxml",
            type: "folder",
            children: [
              {
                name: "schemas",
                type: "folder",
                children: [
                  {
                    name: "ecma",
                    type: "folder",
                    children: [
                      {
                        name: "fouth-edition",
                        type: "folder",
                        children: [
                          { name: "opc-contentTypes.xsd", type: "file" },
                          { name: "opc-coreProperties.xsd", type: "file" },
                          { name: "opc-digSig.xsd", type: "file" },
                          { name: "opc-relationships.xsd", type: "file" },
                        ],
                      },
                    ],
                  },
                  {
                    name: "ISO-IEC29500-4_2016",
                    type: "folder",
                    children: [
                      { name: "dml-chart.xsd", type: "file" },
                      { name: "dml-chartDrawing.xsd", type: "file" },
                      { name: "dml-diagram.xsd", type: "file" },
                      { name: "dml-lockedCanvas.xsd", type: "file" },
                      { name: "dml-main.xsd", type: "file" },
                      { name: "dml-picture.xsd", type: "file" },
                      { name: "dml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "dml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "pml.xsd", type: "file" },
                      {
                        name: "shared-additionalCharacteristics.xsd",
                        type: "file",
                      },
                      { name: "shared-bibliography.xsd", type: "file" },
                      { name: "shared-commonSimpleTypes.xsd", type: "file" },
                      {
                        name: "shared-customXmlDataProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-customXmlSchemaProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesCustom.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesExtended.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesVariantTypes.xsd",
                        type: "file",
                      },
                      { name: "shared-math.xsd", type: "file" },
                      {
                        name: "shared-relationshipReference.xsd",
                        type: "file",
                      },
                      { name: "sml.xsd", type: "file" },
                      { name: "vml-main.xsd", type: "file" },
                      { name: "vml-officeDrawing.xsd", type: "file" },
                      { name: "vml-presentationDrawing.xsd", type: "file" },
                      { name: "vml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "vml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "wml.xsd", type: "file" },
                      { name: "xml.xsd", type: "file" },
                    ],
                  },
                  {
                    name: "mce",
                    type: "folder",
                    children: [{ name: "mc.xsd", type: "file" }],
                  },
                  {
                    name: "microsoft",
                    type: "folder",
                    children: [
                      { name: "wml-2010.xsd", type: "file" },
                      { name: "wml-2012.xsd", type: "file" },
                      { name: "wml-2018.xsd", type: "file" },
                      { name: "wml-cex-2018.xsd", type: "file" },
                      { name: "wml-cid-2016.xsd", type: "file" },
                      { name: "wml-sdtdatahash-2020.xsd", type: "file" },
                      { name: "wml-symex-2015.xsd", type: "file" },
                    ],
                  },
                ],
              },
              {
                name: "scripts",
                type: "folder",
                children: [
                  {
                    name: "validation",
                    type: "folder",
                    children: [
                      { name: "__init__.py", type: "file" },
                      { name: "base.py", type: "file" },
                      { name: "docx.py", type: "file" },
                      { name: "pptx.py", type: "file" },
                      { name: "redlining.py", type: "file" },
                    ],
                  },
                  { name: "pack.py", type: "file" },
                  { name: "unpack.py", type: "file" },
                  { name: "validate.py", type: "file" },
                ],
              },
            ],
          },
          {
            name: "scripts",
            type: "folder",
            children: [
              { name: "html2pptx.js", type: "file" },
              { name: "inventory.py", type: "file" },
              { name: "rearrange.py", type: "file" },
              { name: "replace.py", type: "file" },
              { name: "thumbnail.py", type: "file" },
            ],
          },
          { name: "html2pptx.md", type: "file" },
          { name: "ooxml.md", type: "file" },
          { name: "SKILL.md", type: "file" },
        ],
      },
      {
        name: "xlsx",
        type: "folder",
        children: [
          { name: "recalc.py", type: "file" },
          { name: "SKILL.md", type: "file" },
        ],
      },
    ],
  },
  {
    name: "docx",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [
          {
            name: "office",
            type: "folder",
            children: [
              {
                name: "helpers",
                type: "folder",
                children: [
                  { name: "__init__.py", type: "file" },
                  { name: "merge_runs.py", type: "file" },
                  { name: "simplify_redlines.py", type: "file" },
                ],
              },
              {
                name: "schemas",
                type: "folder",
                children: [
                  {
                    name: "ecma",
                    type: "folder",
                    children: [
                      {
                        name: "fouth-edition",
                        type: "folder",
                        children: [
                          { name: "opc-contentTypes.xsd", type: "file" },
                          { name: "opc-coreProperties.xsd", type: "file" },
                          { name: "opc-digSig.xsd", type: "file" },
                          { name: "opc-relationships.xsd", type: "file" },
                        ],
                      },
                    ],
                  },
                  {
                    name: "ISO-IEC29500-4_2016",
                    type: "folder",
                    children: [
                      { name: "dml-chart.xsd", type: "file" },
                      { name: "dml-chartDrawing.xsd", type: "file" },
                      { name: "dml-diagram.xsd", type: "file" },
                      { name: "dml-lockedCanvas.xsd", type: "file" },
                      { name: "dml-main.xsd", type: "file" },
                      { name: "dml-picture.xsd", type: "file" },
                      { name: "dml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "dml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "pml.xsd", type: "file" },
                      {
                        name: "shared-additionalCharacteristics.xsd",
                        type: "file",
                      },
                      { name: "shared-bibliography.xsd", type: "file" },
                      { name: "shared-commonSimpleTypes.xsd", type: "file" },
                      {
                        name: "shared-customXmlDataProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-customXmlSchemaProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesCustom.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesExtended.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesVariantTypes.xsd",
                        type: "file",
                      },
                      { name: "shared-math.xsd", type: "file" },
                      {
                        name: "shared-relationshipReference.xsd",
                        type: "file",
                      },
                      { name: "sml.xsd", type: "file" },
                      { name: "vml-main.xsd", type: "file" },
                      { name: "vml-officeDrawing.xsd", type: "file" },
                      { name: "vml-presentationDrawing.xsd", type: "file" },
                      { name: "vml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "vml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "wml.xsd", type: "file" },
                      { name: "xml.xsd", type: "file" },
                    ],
                  },
                  {
                    name: "mce",
                    type: "folder",
                    children: [{ name: "mc.xsd", type: "file" }],
                  },
                  {
                    name: "microsoft",
                    type: "folder",
                    children: [
                      { name: "wml-2010.xsd", type: "file" },
                      { name: "wml-2012.xsd", type: "file" },
                      { name: "wml-2018.xsd", type: "file" },
                      { name: "wml-cex-2018.xsd", type: "file" },
                      { name: "wml-cid-2016.xsd", type: "file" },
                      { name: "wml-sdtdatahash-2020.xsd", type: "file" },
                      { name: "wml-symex-2015.xsd", type: "file" },
                    ],
                  },
                ],
              },
              {
                name: "validators",
                type: "folder",
                children: [
                  { name: "__init__.py", type: "file" },
                  { name: "base.py", type: "file" },
                  { name: "docx.py", type: "file" },
                  { name: "pptx.py", type: "file" },
                  { name: "redlining.py", type: "file" },
                ],
              },
              { name: "pack.py", type: "file" },
              { name: "soffice.py", type: "file" },
              { name: "unpack.py", type: "file" },
              { name: "validate.py", type: "file" },
            ],
          },
          {
            name: "templates",
            type: "folder",
            children: [
              { name: "comments.xml", type: "file" },
              { name: "commentsExtended.xml", type: "file" },
              { name: "commentsExtensible.xml", type: "file" },
              { name: "commentsIds.xml", type: "file" },
              { name: "people.xml", type: "file" },
            ],
          },
          { name: "__init__.py", type: "file" },
          { name: "accept_changes.py", type: "file" },
          { name: "comment.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "domain-name-brainstormer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "drugbank-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "chemical-analysis.md", type: "file" },
          { name: "data-access.md", type: "file" },
          { name: "drug-queries.md", type: "file" },
          { name: "interactions.md", type: "file" },
          { name: "targets-pathways.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "drugbank_helper.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "edgartools",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "ai-integration.md", type: "file" },
          { name: "companies.md", type: "file" },
          { name: "data-objects.md", type: "file" },
          { name: "entity-facts.md", type: "file" },
          { name: "filings.md", type: "file" },
          { name: "financial-data.md", type: "file" },
          { name: "xbrl.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "ena-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "ensembl-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_endpoints.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "ensembl_query.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "esm",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "esm3-api.md", type: "file" },
          { name: "esm-c-api.md", type: "file" },
          { name: "forge-api.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "etetoolkit",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "visualization.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "quick_visualize.py", type: "file" },
          { name: "tree_operations.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "exploratory-data-analysis",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: "report_template.md", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "bioinformatics_genomics_formats.md", type: "file" },
          { name: "chemistry_molecular_formats.md", type: "file" },
          { name: "general_scientific_formats.md", type: "file" },
          { name: "microscopy_imaging_formats.md", type: "file" },
          { name: "proteomics_metabolomics_formats.md", type: "file" },
          { name: "spectroscopy_analytical_formats.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "eda_analyzer.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "fda-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "animal_veterinary.md", type: "file" },
          { name: "api_basics.md", type: "file" },
          { name: "devices.md", type: "file" },
          { name: "drugs.md", type: "file" },
          { name: "foods.md", type: "file" },
          { name: "other.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "fda_examples.py", type: "file" },
          { name: "fda_query.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "file-organizer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "flowio",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "fluidsim",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced_features.md", type: "file" },
          { name: "installation.md", type: "file" },
          { name: "output_analysis.md", type: "file" },
          { name: "parameters.md", type: "file" },
          { name: "simulation_workflow.md", type: "file" },
          { name: "solvers.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "fred-economic-data",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_basics.md", type: "file" },
          { name: "categories.md", type: "file" },
          { name: "geofred.md", type: "file" },
          { name: "releases.md", type: "file" },
          { name: "series.md", type: "file" },
          { name: "sources.md", type: "file" },
          { name: "tags.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "fred_examples.py", type: "file" },
          { name: "fred_query.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "frontend-design",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "frontend-excellence",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "gene-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "common_workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "batch_gene_lookup.py", type: "file" },
          { name: "fetch_gene_data.py", type: "file" },
          { name: "query_gene.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "generate-image",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "generate_image.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "geniml",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "bedspace.md", type: "file" },
          { name: "consensus_peaks.md", type: "file" },
          { name: "region2vec.md", type: "file" },
          { name: "scembed.md", type: "file" },
          { name: "utilities.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "geo-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "geo_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "geomaster",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced-gis.md", type: "file" },
          { name: "big-data.md", type: "file" },
          { name: "code-examples.md", type: "file" },
          { name: "coordinate-systems.md", type: "file" },
          { name: "core-libraries.md", type: "file" },
          { name: "data-sources.md", type: "file" },
          { name: "gis-software.md", type: "file" },
          { name: "industry-applications.md", type: "file" },
          { name: "machine-learning.md", type: "file" },
          { name: "programming-languages.md", type: "file" },
          { name: "remote-sensing.md", type: "file" },
          { name: "scientific-domains.md", type: "file" },
          { name: "specialized-topics.md", type: "file" },
          { name: "troubleshooting.md", type: "file" },
        ],
      },
      { name: "README.md", type: "file" },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "geopandas",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "crs-management.md", type: "file" },
          { name: "data-io.md", type: "file" },
          { name: "data-structures.md", type: "file" },
          { name: "geometric-operations.md", type: "file" },
          { name: "spatial-analysis.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "get-available-resources",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "detect_resources.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "gget",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "database_info.md", type: "file" },
          { name: "module_reference.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "batch_sequence_analysis.py", type: "file" },
          { name: "enrichment_pipeline.py", type: "file" },
          { name: "gene_analysis.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "ginkgo-cloud-lab",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          {
            name: "cell-free-protein-expression-optimization.md",
            type: "file",
          },
          { name: "cell-free-protein-expression-validation.md", type: "file" },
          { name: "fluorescent-pixel-art-generation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "git-advanced",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "glycoengineering",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "glycan_databases.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "gnomad-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "graphql_queries.md", type: "file" },
          { name: "variant_interpretation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "golang-idioms",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "graphql-design",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "gtars",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "cli.md", type: "file" },
          { name: "coverage.md", type: "file" },
          { name: "overlap.md", type: "file" },
          { name: "python-api.md", type: "file" },
          { name: "refget.md", type: "file" },
          { name: "tokenizers.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "gtex-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "gwas-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "hedgefundmonitor",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api-overview.md", type: "file" },
          { name: "datasets.md", type: "file" },
          { name: "endpoints-combined.md", type: "file" },
          { name: "endpoints-metadata.md", type: "file" },
          { name: "endpoints-series-data.md", type: "file" },
          { name: "examples.md", type: "file" },
          { name: "parameters.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "histolab",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "filters_preprocessing.md", type: "file" },
          { name: "slide_management.md", type: "file" },
          { name: "tile_extraction.md", type: "file" },
          { name: "tissue_masks.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "hmdb-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "hmdb_data_fields.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "hypogenic",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "config_template.yaml", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "hypothesis-generation",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "FORMATTING_GUIDE.md", type: "file" },
          { name: "hypothesis_generation.sty", type: "file" },
          { name: "hypothesis_report_template.tex", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "experimental_design_patterns.md", type: "file" },
          { name: "hypothesis_quality_criteria.md", type: "file" },
          { name: "literature_search_strategies.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "image-enhancer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "imaging-data-commons",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "bigquery_guide.md", type: "file" },
          { name: "cli_guide.md", type: "file" },
          { name: "clinical_data_guide.md", type: "file" },
          { name: "cloud_storage_guide.md", type: "file" },
          { name: "dicomweb_guide.md", type: "file" },
          { name: "digital_pathology_guide.md", type: "file" },
          { name: "index_tables_guide.md", type: "file" },
          { name: "sql_patterns.md", type: "file" },
          { name: "use_cases.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "infographics",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "color_palettes.md", type: "file" },
          { name: "design_principles.md", type: "file" },
          { name: "infographic_types.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "generate_infographic.py", type: "file" },
          { name: "generate_infographic_ai.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "internal-comms",
    type: "folder",
    children: [
      {
        name: "examples",
        type: "folder",
        children: [
          { name: "3p-updates.md", type: "file" },
          { name: "company-newsletter.md", type: "file" },
          { name: "faq-answers.md", type: "file" },
          { name: "general-comms.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "interpro-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "domain_analysis.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "invoice-organizer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "iso-13485-certification",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          {
            name: "templates",
            type: "folder",
            children: [
              {
                name: "procedures",
                type: "folder",
                children: [
                  { name: "CAPA-procedure-template.md", type: "file" },
                  {
                    name: "document-control-procedure-template.md",
                    type: "file",
                  },
                ],
              },
              { name: "quality-manual-template.md", type: "file" },
            ],
          },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "gap-analysis-checklist.md", type: "file" },
          { name: "iso-13485-requirements.md", type: "file" },
          { name: "mandatory-documents.md", type: "file" },
          { name: "quality-manual-guide.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "gap_analyzer.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "jaspar-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "kegg-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "kegg_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "kegg_api.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "kubernetes-operations",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "labarchive-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "authentication_guide.md", type: "file" },
          { name: "integrations.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "entry_operations.py", type: "file" },
          { name: "notebook_operations.py", type: "file" },
          { name: "setup_config.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "lamindb",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "annotation-validation.md", type: "file" },
          { name: "core-concepts.md", type: "file" },
          { name: "data-management.md", type: "file" },
          { name: "integrations.md", type: "file" },
          { name: "ontologies.md", type: "file" },
          { name: "setup-deployment.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "langsmith-fetch",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "latchbio-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "data-management.md", type: "file" },
          { name: "resource-configuration.md", type: "file" },
          { name: "verified-workflows.md", type: "file" },
          { name: "workflow-creation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "latex-posters",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "baposter_template.tex", type: "file" },
          { name: "beamerposter_template.tex", type: "file" },
          { name: "poster_quality_checklist.md", type: "file" },
          { name: "tikzposter_template.tex", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "latex_poster_packages.md", type: "file" },
          { name: "poster_content_guide.md", type: "file" },
          { name: "poster_design_principles.md", type: "file" },
          { name: "poster_layout_design.md", type: "file" },
          { name: "README.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "review_poster.sh", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "lead-research-assistant",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "literature-review",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: "review_template.md", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "citation_styles.md", type: "file" },
          { name: "database_strategies.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "generate_pdf.py", type: "file" },
          { name: "search_databases.py", type: "file" },
          { name: "verify_citations.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "llm-integration",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "markdown-mermaid-writing",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          {
            name: "examples",
            type: "folder",
            children: [{ name: "example-research-report.md", type: "file" }],
          },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          {
            name: "diagrams",
            type: "folder",
            children: [
              { name: "architecture.md", type: "file" },
              { name: "block.md", type: "file" },
              { name: "c4.md", type: "file" },
              { name: "class.md", type: "file" },
              { name: "complex_examples.md", type: "file" },
              { name: "er.md", type: "file" },
              { name: "flowchart.md", type: "file" },
              { name: "gantt.md", type: "file" },
              { name: "git_graph.md", type: "file" },
              { name: "kanban.md", type: "file" },
              { name: "mindmap.md", type: "file" },
              { name: "packet.md", type: "file" },
              { name: "pie.md", type: "file" },
              { name: "quadrant.md", type: "file" },
              { name: "radar.md", type: "file" },
              { name: "requirement.md", type: "file" },
              { name: "sankey.md", type: "file" },
              { name: "sequence.md", type: "file" },
              { name: "state.md", type: "file" },
              { name: "timeline.md", type: "file" },
              { name: "treemap.md", type: "file" },
              { name: "user_journey.md", type: "file" },
              { name: "xy_chart.md", type: "file" },
              { name: "zenuml.md", type: "file" },
            ],
          },
          { name: "markdown_style_guide.md", type: "file" },
          { name: "mermaid_style_guide.md", type: "file" },
        ],
      },
      {
        name: "templates",
        type: "folder",
        children: [
          { name: "decision_record.md", type: "file" },
          { name: "how_to_guide.md", type: "file" },
          { name: "issue.md", type: "file" },
          { name: "kanban.md", type: "file" },
          { name: "presentation.md", type: "file" },
          { name: "project_documentation.md", type: "file" },
          { name: "pull_request.md", type: "file" },
          { name: "research_paper.md", type: "file" },
          { name: "status_report.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "market-research-reports",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "FORMATTING_GUIDE.md", type: "file" },
          { name: "market_report_template.tex", type: "file" },
          { name: "market_research.sty", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "data_analysis_patterns.md", type: "file" },
          { name: "report_structure_guide.md", type: "file" },
          { name: "visual_generation_guide.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "generate_market_visuals.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "markitdown",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: "example_usage.md", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "file_formats.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "batch_convert.py", type: "file" },
          { name: "convert_literature.py", type: "file" },
          { name: "convert_with_ai.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "matchms",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "filtering.md", type: "file" },
          { name: "importing_exporting.md", type: "file" },
          { name: "similarity.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "matlab",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "data-import-export.md", type: "file" },
          { name: "executing-scripts.md", type: "file" },
          { name: "graphics-visualization.md", type: "file" },
          { name: "mathematics.md", type: "file" },
          { name: "matrices-arrays.md", type: "file" },
          { name: "octave-compatibility.md", type: "file" },
          { name: "programming.md", type: "file" },
          { name: "python-integration.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "matplotlib",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "common_issues.md", type: "file" },
          { name: "plot_types.md", type: "file" },
          { name: "styling_guide.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "plot_template.py", type: "file" },
          { name: "style_configurator.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "mcp-builder",
    type: "folder",
    children: [
      {
        name: "reference",
        type: "folder",
        children: [
          { name: "evaluation.md", type: "file" },
          { name: "mcp_best_practices.md", type: "file" },
          { name: "node_mcp_server.md", type: "file" },
          { name: "python_mcp_server.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "connections.py", type: "file" },
          { name: "evaluation.py", type: "file" },
          { name: "example_evaluation.xml", type: "file" },
          { name: "requirements.txt", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "mcp-development",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "medchem",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_guide.md", type: "file" },
          { name: "rules_catalog.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "filter_molecules.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "meeting-insights-analyzer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "metabolomics-workbench-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "microservices-design",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "mobile-development",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "modal",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "examples.md", type: "file" },
          { name: "functions.md", type: "file" },
          { name: "getting-started.md", type: "file" },
          { name: "gpu.md", type: "file" },
          { name: "images.md", type: "file" },
          { name: "resources.md", type: "file" },
          { name: "scaling.md", type: "file" },
          { name: "scheduled-jobs.md", type: "file" },
          { name: "secrets.md", type: "file" },
          { name: "volumes.md", type: "file" },
          { name: "web-endpoints.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "molecular-dynamics",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "mdanalysis_analysis.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "molfeat",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "available_featurizers.md", type: "file" },
          { name: "examples.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "monarch-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "phenotype_ontology.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "monitoring-observability",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "networkx",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "algorithms.md", type: "file" },
          { name: "generators.md", type: "file" },
          { name: "graph-basics.md", type: "file" },
          { name: "io.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "neurokit2",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "bio_module.md", type: "file" },
          { name: "complexity.md", type: "file" },
          { name: "ecg_cardiac.md", type: "file" },
          { name: "eda.md", type: "file" },
          { name: "eeg.md", type: "file" },
          { name: "emg.md", type: "file" },
          { name: "eog.md", type: "file" },
          { name: "epochs_events.md", type: "file" },
          { name: "hrv.md", type: "file" },
          { name: "ppg.md", type: "file" },
          { name: "rsp.md", type: "file" },
          { name: "signal_processing.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "neuropixels-analysis",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: "analysis_template.py", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "AI_CURATION.md", type: "file" },
          { name: "ANALYSIS.md", type: "file" },
          { name: "api_reference.md", type: "file" },
          { name: "AUTOMATED_CURATION.md", type: "file" },
          { name: "MOTION_CORRECTION.md", type: "file" },
          { name: "plotting_guide.md", type: "file" },
          { name: "PREPROCESSING.md", type: "file" },
          { name: "QUALITY_METRICS.md", type: "file" },
          { name: "SPIKE_SORTING.md", type: "file" },
          { name: "standard_workflow.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "compute_metrics.py", type: "file" },
          { name: "explore_recording.py", type: "file" },
          { name: "export_to_phy.py", type: "file" },
          { name: "neuropixels_pipeline.py", type: "file" },
          { name: "preprocess_recording.py", type: "file" },
          { name: "run_sorting.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "nextjs-mastery",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "offer-k-dense-web",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "omero-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced.md", type: "file" },
          { name: "connection.md", type: "file" },
          { name: "data_access.md", type: "file" },
          { name: "image_processing.md", type: "file" },
          { name: "metadata.md", type: "file" },
          { name: "rois.md", type: "file" },
          { name: "scripts.md", type: "file" },
          { name: "tables.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "openalex-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_guide.md", type: "file" },
          { name: "common_queries.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "openalex_client.py", type: "file" },
          { name: "query_helpers.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "open-notebook",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "architecture.md", type: "file" },
          { name: "configuration.md", type: "file" },
          { name: "examples.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "chat_interaction.py", type: "file" },
          { name: "notebook_management.py", type: "file" },
          { name: "source_ingestion.py", type: "file" },
          { name: "test_open_notebook_skill.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "opentargets-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "evidence_types.md", type: "file" },
          { name: "target_annotations.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "query_opentargets.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "opentrons-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "basic_protocol_template.py", type: "file" },
          { name: "pcr_setup_template.py", type: "file" },
          { name: "serial_dilution_template.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "paper-2-web",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "installation.md", type: "file" },
          { name: "paper2poster.md", type: "file" },
          { name: "paper2video.md", type: "file" },
          { name: "paper2web.md", type: "file" },
          { name: "usage_examples.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "parallel-web",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "deep_research_guide.md", type: "file" },
          { name: "extraction_patterns.md", type: "file" },
          { name: "search_best_practices.md", type: "file" },
          { name: "workflow_recipes.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "parallel_web.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pathml",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "data_management.md", type: "file" },
          { name: "graphs.md", type: "file" },
          { name: "image_loading.md", type: "file" },
          { name: "machine_learning.md", type: "file" },
          { name: "multiparametric.md", type: "file" },
          { name: "preprocessing.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pdb-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pdf",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "check_bounding_boxes.py", type: "file" },
          { name: "check_fillable_fields.py", type: "file" },
          { name: "convert_pdf_to_images.py", type: "file" },
          { name: "create_validation_image.py", type: "file" },
          { name: "extract_form_field_info.py", type: "file" },
          { name: "extract_form_structure.py", type: "file" },
          { name: "fill_fillable_fields.py", type: "file" },
          { name: "fill_pdf_form_with_annotations.py", type: "file" },
        ],
      },
      { name: "forms.md", type: "file" },
      { name: "reference.md", type: "file" },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "peer-review",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "common_issues.md", type: "file" },
          { name: "reporting_standards.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pennylane",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced_features.md", type: "file" },
          { name: "devices_backends.md", type: "file" },
          { name: "getting_started.md", type: "file" },
          { name: "optimization.md", type: "file" },
          { name: "quantum_chemistry.md", type: "file" },
          { name: "quantum_circuits.md", type: "file" },
          { name: "quantum_ml.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "performance-optimization",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "perplexity-search",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: ".env.example", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "model_comparison.md", type: "file" },
          { name: "openrouter_setup.md", type: "file" },
          { name: "search_strategies.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "perplexity_search.py", type: "file" },
          { name: "setup_env.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "phylogenetics",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "iqtree_inference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "phylogenetic_analysis.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "plotly",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "chart-types.md", type: "file" },
          { name: "export-interactivity.md", type: "file" },
          { name: "graph-objects.md", type: "file" },
          { name: "layouts-styling.md", type: "file" },
          { name: "plotly-express.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "polars",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "best_practices.md", type: "file" },
          { name: "core_concepts.md", type: "file" },
          { name: "io_guide.md", type: "file" },
          { name: "operations.md", type: "file" },
          { name: "pandas_migration.md", type: "file" },
          { name: "transformations.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "postgres-optimization",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "pptx",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [
          {
            name: "office",
            type: "folder",
            children: [
              {
                name: "helpers",
                type: "folder",
                children: [
                  { name: "__init__.py", type: "file" },
                  { name: "merge_runs.py", type: "file" },
                  { name: "simplify_redlines.py", type: "file" },
                ],
              },
              {
                name: "schemas",
                type: "folder",
                children: [
                  {
                    name: "ecma",
                    type: "folder",
                    children: [
                      {
                        name: "fouth-edition",
                        type: "folder",
                        children: [
                          { name: "opc-contentTypes.xsd", type: "file" },
                          { name: "opc-coreProperties.xsd", type: "file" },
                          { name: "opc-digSig.xsd", type: "file" },
                          { name: "opc-relationships.xsd", type: "file" },
                        ],
                      },
                    ],
                  },
                  {
                    name: "ISO-IEC29500-4_2016",
                    type: "folder",
                    children: [
                      { name: "dml-chart.xsd", type: "file" },
                      { name: "dml-chartDrawing.xsd", type: "file" },
                      { name: "dml-diagram.xsd", type: "file" },
                      { name: "dml-lockedCanvas.xsd", type: "file" },
                      { name: "dml-main.xsd", type: "file" },
                      { name: "dml-picture.xsd", type: "file" },
                      { name: "dml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "dml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "pml.xsd", type: "file" },
                      {
                        name: "shared-additionalCharacteristics.xsd",
                        type: "file",
                      },
                      { name: "shared-bibliography.xsd", type: "file" },
                      { name: "shared-commonSimpleTypes.xsd", type: "file" },
                      {
                        name: "shared-customXmlDataProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-customXmlSchemaProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesCustom.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesExtended.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesVariantTypes.xsd",
                        type: "file",
                      },
                      { name: "shared-math.xsd", type: "file" },
                      {
                        name: "shared-relationshipReference.xsd",
                        type: "file",
                      },
                      { name: "sml.xsd", type: "file" },
                      { name: "vml-main.xsd", type: "file" },
                      { name: "vml-officeDrawing.xsd", type: "file" },
                      { name: "vml-presentationDrawing.xsd", type: "file" },
                      { name: "vml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "vml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "wml.xsd", type: "file" },
                      { name: "xml.xsd", type: "file" },
                    ],
                  },
                  {
                    name: "mce",
                    type: "folder",
                    children: [{ name: "mc.xsd", type: "file" }],
                  },
                  {
                    name: "microsoft",
                    type: "folder",
                    children: [
                      { name: "wml-2010.xsd", type: "file" },
                      { name: "wml-2012.xsd", type: "file" },
                      { name: "wml-2018.xsd", type: "file" },
                      { name: "wml-cex-2018.xsd", type: "file" },
                      { name: "wml-cid-2016.xsd", type: "file" },
                      { name: "wml-sdtdatahash-2020.xsd", type: "file" },
                      { name: "wml-symex-2015.xsd", type: "file" },
                    ],
                  },
                ],
              },
              {
                name: "validators",
                type: "folder",
                children: [
                  { name: "__init__.py", type: "file" },
                  { name: "base.py", type: "file" },
                  { name: "docx.py", type: "file" },
                  { name: "pptx.py", type: "file" },
                  { name: "redlining.py", type: "file" },
                ],
              },
              { name: "pack.py", type: "file" },
              { name: "soffice.py", type: "file" },
              { name: "unpack.py", type: "file" },
              { name: "validate.py", type: "file" },
            ],
          },
          { name: "__init__.py", type: "file" },
          { name: "add_slide.py", type: "file" },
          { name: "clean.py", type: "file" },
          { name: "thumbnail.py", type: "file" },
        ],
      },
      { name: "editing.md", type: "file" },
      { name: "pptxgenjs.md", type: "file" },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pptx-posters",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "poster_html_template.html", type: "file" },
          { name: "poster_quality_checklist.md", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "poster_content_guide.md", type: "file" },
          { name: "poster_design_principles.md", type: "file" },
          { name: "poster_layout_design.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "primekg",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "query_primekg.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "prompt-engineering",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "protocolsio-integration",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "additional_features.md", type: "file" },
          { name: "authentication.md", type: "file" },
          { name: "discussions.md", type: "file" },
          { name: "file_manager.md", type: "file" },
          { name: "protocols_api.md", type: "file" },
          { name: "workspaces.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pubchem-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "bioactivity_query.py", type: "file" },
          { name: "compound_search.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pubmed-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "common_queries.md", type: "file" },
          { name: "search_syntax.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pufferlib",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "environments.md", type: "file" },
          { name: "integration.md", type: "file" },
          { name: "policies.md", type: "file" },
          { name: "training.md", type: "file" },
          { name: "vectorization.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "env_template.py", type: "file" },
          { name: "train_template.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pydeseq2",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "workflow_guide.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "run_deseq2_analysis.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pydicom",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "common_tags.md", type: "file" },
          { name: "transfer_syntaxes.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "anonymize_dicom.py", type: "file" },
          { name: "dicom_to_image.py", type: "file" },
          { name: "extract_metadata.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pyhealth",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "datasets.md", type: "file" },
          { name: "medical_coding.md", type: "file" },
          { name: "models.md", type: "file" },
          { name: "preprocessing.md", type: "file" },
          { name: "tasks.md", type: "file" },
          { name: "training_evaluation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pylabrobot",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "analytical-equipment.md", type: "file" },
          { name: "hardware-backends.md", type: "file" },
          { name: "liquid-handling.md", type: "file" },
          { name: "material-handling.md", type: "file" },
          { name: "resources.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pymatgen",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "analysis_modules.md", type: "file" },
          { name: "core_classes.md", type: "file" },
          { name: "io_formats.md", type: "file" },
          { name: "materials_project_api.md", type: "file" },
          { name: "transformations_workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "phase_diagram_generator.py", type: "file" },
          { name: "structure_analyzer.py", type: "file" },
          { name: "structure_converter.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pymc",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "hierarchical_model_template.py", type: "file" },
          { name: "linear_regression_template.py", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "distributions.md", type: "file" },
          { name: "sampling_inference.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "model_comparison.py", type: "file" },
          { name: "model_diagnostics.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pymoo",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "algorithms.md", type: "file" },
          { name: "constraints_mcdm.md", type: "file" },
          { name: "operators.md", type: "file" },
          { name: "problems.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "custom_problem_example.py", type: "file" },
          { name: "decision_making_example.py", type: "file" },
          { name: "many_objective_example.py", type: "file" },
          { name: "multi_objective_example.py", type: "file" },
          { name: "single_objective_example.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pyopenms",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "data_structures.md", type: "file" },
          { name: "feature_detection.md", type: "file" },
          { name: "file_io.md", type: "file" },
          { name: "identification.md", type: "file" },
          { name: "metabolomics.md", type: "file" },
          { name: "signal_processing.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pysam",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "alignment_files.md", type: "file" },
          { name: "common_workflows.md", type: "file" },
          { name: "sequence_files.md", type: "file" },
          { name: "variant_files.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pytdc",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "datasets.md", type: "file" },
          { name: "oracles.md", type: "file" },
          { name: "utilities.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "benchmark_evaluation.py", type: "file" },
          { name: "load_and_split_data.py", type: "file" },
          { name: "molecular_generation.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "python-best-practices",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "pytorch-lightning",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "best_practices.md", type: "file" },
          { name: "callbacks.md", type: "file" },
          { name: "data_module.md", type: "file" },
          { name: "distributed_training.md", type: "file" },
          { name: "lightning_module.md", type: "file" },
          { name: "logging.md", type: "file" },
          { name: "trainer.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "quick_trainer_setup.py", type: "file" },
          { name: "template_datamodule.py", type: "file" },
          { name: "template_lightning_module.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "pyzotero",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "authentication.md", type: "file" },
          { name: "cli.md", type: "file" },
          { name: "collections.md", type: "file" },
          { name: "error-handling.md", type: "file" },
          { name: "exports.md", type: "file" },
          { name: "files-attachments.md", type: "file" },
          { name: "full-text.md", type: "file" },
          { name: "pagination.md", type: "file" },
          { name: "read-api.md", type: "file" },
          { name: "saved-searches.md", type: "file" },
          { name: "search-params.md", type: "file" },
          { name: "tags.md", type: "file" },
          { name: "write-api.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "qiskit",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "algorithms.md", type: "file" },
          { name: "backends.md", type: "file" },
          { name: "circuits.md", type: "file" },
          { name: "patterns.md", type: "file" },
          { name: "primitives.md", type: "file" },
          { name: "setup.md", type: "file" },
          { name: "transpilation.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "qutip",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced.md", type: "file" },
          { name: "analysis.md", type: "file" },
          { name: "core_concepts.md", type: "file" },
          { name: "time_evolution.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "raffle-winner-picker",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "rdkit",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "descriptors_reference.md", type: "file" },
          { name: "smarts_patterns.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "molecular_properties.py", type: "file" },
          { name: "similarity_search.py", type: "file" },
          { name: "substructure_filter.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "reactome-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "reactome_query.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "react-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "redis-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "research-grants",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "budget_justification_template.md", type: "file" },
          { name: "nih_specific_aims_template.md", type: "file" },
          { name: "nsf_project_summary_template.md", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "broader_impacts.md", type: "file" },
          { name: "darpa_guidelines.md", type: "file" },
          { name: "doe_guidelines.md", type: "file" },
          { name: "nih_guidelines.md", type: "file" },
          { name: "nsf_guidelines.md", type: "file" },
          { name: "nstc_guidelines.md", type: "file" },
          { name: "README.md", type: "file" },
          { name: "specific_aims_guide.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "research-lookup",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "research_lookup.py", type: "file" }],
      },
      { name: "examples.py", type: "file" },
      { name: "lookup.py", type: "file" },
      { name: "README.md", type: "file" },
      { name: "research_lookup.py", type: "file" },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "rowan",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "molecule_handling.md", type: "file" },
          { name: "proteins_and_organization.md", type: "file" },
          { name: "rdkit_native.md", type: "file" },
          { name: "results_interpretation.md", type: "file" },
          { name: "workflow_types.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "rust-systems",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "scanpy",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [{ name: "analysis_template.py", type: "file" }],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "plotting_guide.md", type: "file" },
          { name: "standard_workflow.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "qc_analysis.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scholar-evaluation",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "evaluation_framework.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "calculate_scores.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scientific-brainstorming",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "brainstorming_methods.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scientific-critical-thinking",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "common_biases.md", type: "file" },
          { name: "evidence_hierarchy.md", type: "file" },
          { name: "experimental_design.md", type: "file" },
          { name: "logical_fallacies.md", type: "file" },
          { name: "scientific_method.md", type: "file" },
          { name: "statistical_pitfalls.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scientific-schematics",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "best_practices.md", type: "file" },
          { name: "QUICK_REFERENCE.md", type: "file" },
          { name: "README.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "example_usage.sh", type: "file" },
          { name: "generate_schematic.py", type: "file" },
          { name: "generate_schematic_ai.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scientific-slides",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "beamer_template_conference.tex", type: "file" },
          { name: "beamer_template_defense.tex", type: "file" },
          { name: "beamer_template_seminar.tex", type: "file" },
          { name: "powerpoint_design_guide.md", type: "file" },
          { name: "timing_guidelines.md", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "beamer_guide.md", type: "file" },
          { name: "data_visualization_slides.md", type: "file" },
          { name: "presentation_structure.md", type: "file" },
          { name: "slide_design_principles.md", type: "file" },
          { name: "talk_types_guide.md", type: "file" },
          { name: "visual_review_workflow.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "generate_slide_image.py", type: "file" },
          { name: "generate_slide_image_ai.py", type: "file" },
          { name: "pdf_to_images.py", type: "file" },
          { name: "slides_to_pdf.py", type: "file" },
          { name: "validate_presentation.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scientific-visualization",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "color_palettes.py", type: "file" },
          { name: "nature.mplstyle", type: "file" },
          { name: "presentation.mplstyle", type: "file" },
          { name: "publication.mplstyle", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "color_palettes.md", type: "file" },
          { name: "journal_requirements.md", type: "file" },
          { name: "matplotlib_examples.md", type: "file" },
          { name: "publication_guidelines.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "figure_export.py", type: "file" },
          { name: "style_presets.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scientific-writing",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "REPORT_FORMATTING_GUIDE.md", type: "file" },
          { name: "scientific_report.sty", type: "file" },
          { name: "scientific_report_template.tex", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "citation_styles.md", type: "file" },
          { name: "figures_tables.md", type: "file" },
          { name: "imrad_structure.md", type: "file" },
          { name: "professional_report_formatting.md", type: "file" },
          { name: "reporting_guidelines.md", type: "file" },
          { name: "writing_principles.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scikit-bio",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scikit-learn",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "model_evaluation.md", type: "file" },
          { name: "pipelines_and_composition.md", type: "file" },
          { name: "preprocessing.md", type: "file" },
          { name: "quick_reference.md", type: "file" },
          { name: "supervised_learning.md", type: "file" },
          { name: "unsupervised_learning.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "classification_pipeline.py", type: "file" },
          { name: "clustering_analysis.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scikit-survival",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "competing-risks.md", type: "file" },
          { name: "cox-models.md", type: "file" },
          { name: "data-handling.md", type: "file" },
          { name: "ensemble-models.md", type: "file" },
          { name: "evaluation-metrics.md", type: "file" },
          { name: "svm-models.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scvelo",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "velocity_models.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "rna_velocity_workflow.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "scvi-tools",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "differential-expression.md", type: "file" },
          { name: "models-atac-seq.md", type: "file" },
          { name: "models-multimodal.md", type: "file" },
          { name: "models-scrna-seq.md", type: "file" },
          { name: "models-spatial.md", type: "file" },
          { name: "models-specialized.md", type: "file" },
          { name: "theoretical-foundations.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "seaborn",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "examples.md", type: "file" },
          { name: "function_reference.md", type: "file" },
          { name: "objects_interface.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "security-hardening",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "shap",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "explainers.md", type: "file" },
          { name: "plots.md", type: "file" },
          { name: "theory.md", type: "file" },
          { name: "workflows.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "simpy",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "events.md", type: "file" },
          { name: "monitoring.md", type: "file" },
          { name: "process-interaction.md", type: "file" },
          { name: "real-time.md", type: "file" },
          { name: "resources.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "basic_simulation_template.py", type: "file" },
          { name: "resource_monitor.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "skill-creator",
    type: "folder",
    children: [
      {
        name: "agents",
        type: "folder",
        children: [
          { name: "analyzer.md", type: "file" },
          { name: "comparator.md", type: "file" },
          { name: "grader.md", type: "file" },
        ],
      },
      {
        name: "assets",
        type: "folder",
        children: [{ name: "eval_review.html", type: "file" }],
      },
      {
        name: "eval-viewer",
        type: "folder",
        children: [
          { name: "generate_review.py", type: "file" },
          { name: "viewer.html", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [{ name: "schemas.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "__init__.py", type: "file" },
          { name: "aggregate_benchmark.py", type: "file" },
          { name: "generate_report.py", type: "file" },
          { name: "improve_description.py", type: "file" },
          { name: "init_skill.py", type: "file" },
          { name: "package_skill.py", type: "file" },
          { name: "quick_validate.py", type: "file" },
          { name: "run_eval.py", type: "file" },
          { name: "run_loop.py", type: "file" },
          { name: "utils.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "skill-share",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "slack-gif-creator",
    type: "folder",
    children: [
      {
        name: "core",
        type: "folder",
        children: [
          { name: "color_palettes.py", type: "file" },
          { name: "easing.py", type: "file" },
          { name: "frame_composer.py", type: "file" },
          { name: "gif_builder.py", type: "file" },
          { name: "typography.py", type: "file" },
          { name: "validators.py", type: "file" },
          { name: "visual_effects.py", type: "file" },
        ],
      },
      {
        name: "templates",
        type: "folder",
        children: [
          { name: "bounce.py", type: "file" },
          { name: "explode.py", type: "file" },
          { name: "fade.py", type: "file" },
          { name: "flip.py", type: "file" },
          { name: "kaleidoscope.py", type: "file" },
          { name: "morph.py", type: "file" },
          { name: "move.py", type: "file" },
          { name: "pulse.py", type: "file" },
          { name: "shake.py", type: "file" },
          { name: "slide.py", type: "file" },
          { name: "spin.py", type: "file" },
          { name: "wiggle.py", type: "file" },
          { name: "zoom.py", type: "file" },
        ],
      },
      { name: "requirements.txt", type: "file" },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "springboot-patterns",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "stable-baselines3",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "algorithms.md", type: "file" },
          { name: "callbacks.md", type: "file" },
          { name: "custom_environments.md", type: "file" },
          { name: "vectorized_envs.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "custom_env_template.py", type: "file" },
          { name: "evaluate_agent.py", type: "file" },
          { name: "train_rl_agent.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "statistical-analysis",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "assumptions_and_diagnostics.md", type: "file" },
          { name: "bayesian_statistics.md", type: "file" },
          { name: "effect_sizes_and_power.md", type: "file" },
          { name: "reporting_standards.md", type: "file" },
          { name: "test_selection_guide.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "assumption_checks.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "statsmodels",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "discrete_choice.md", type: "file" },
          { name: "glm.md", type: "file" },
          { name: "linear_models.md", type: "file" },
          { name: "stats_diagnostics.md", type: "file" },
          { name: "time_series.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "string-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "string_reference.md", type: "file" }],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "string_api.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "sympy",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "advanced-topics.md", type: "file" },
          { name: "code-generation-printing.md", type: "file" },
          { name: "core-capabilities.md", type: "file" },
          { name: "matrices-linear-algebra.md", type: "file" },
          { name: "physics-mechanics.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "tailored-resume-generator",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "tdd-mastery",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "template-skill",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "testing-strategies",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "theme-factory",
    type: "folder",
    children: [
      {
        name: "themes",
        type: "folder",
        children: [
          { name: "arctic-frost.md", type: "file" },
          { name: "botanical-garden.md", type: "file" },
          { name: "desert-rose.md", type: "file" },
          { name: "forest-canopy.md", type: "file" },
          { name: "golden-hour.md", type: "file" },
          { name: "midnight-galaxy.md", type: "file" },
          { name: "modern-minimalist.md", type: "file" },
          { name: "ocean-depths.md", type: "file" },
          { name: "sunset-boulevard.md", type: "file" },
          { name: "tech-innovation.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
      { name: "theme-showcase.pdf", type: "file" },
    ],
  },
  {
    name: "tiledbvcf",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "timesfm-forecasting",
    type: "folder",
    children: [
      {
        name: "examples",
        type: "folder",
        children: [
          {
            name: "anomaly-detection",
            type: "folder",
            children: [
              {
                name: "output",
                type: "folder",
                children: [
                  { name: "anomaly_detection.json", type: "file" },
                  { name: "anomaly_detection.png", type: "file" },
                ],
              },
              { name: "detect_anomalies.py", type: "file" },
            ],
          },
          {
            name: "covariates-forecasting",
            type: "folder",
            children: [
              {
                name: "output",
                type: "folder",
                children: [
                  { name: "covariates_data.png", type: "file" },
                  { name: "covariates_metadata.json", type: "file" },
                  { name: "sales_with_covariates.csv", type: "file" },
                ],
              },
              { name: "demo_covariates.py", type: "file" },
            ],
          },
          {
            name: "global-temperature",
            type: "folder",
            children: [
              {
                name: "output",
                type: "folder",
                children: [
                  { name: "animation_data.json", type: "file" },
                  { name: "forecast_animation.gif", type: "file" },
                  { name: "forecast_output.csv", type: "file" },
                  { name: "forecast_output.json", type: "file" },
                  { name: "forecast_visualization.png", type: "file" },
                  { name: "interactive_forecast.html", type: "file" },
                ],
              },
              { name: "generate_animation_data.py", type: "file" },
              { name: "generate_gif.py", type: "file" },
              { name: "generate_html.py", type: "file" },
              { name: "README.md", type: "file" },
              { name: "run_example.sh", type: "file" },
              { name: "run_forecast.py", type: "file" },
              { name: "temperature_anomaly.csv", type: "file" },
              { name: "visualize_forecast.py", type: "file" },
            ],
          },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_reference.md", type: "file" },
          { name: "data_preparation.md", type: "file" },
          { name: "system_requirements.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "check_system.py", type: "file" },
          { name: "forecast_csv.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "torchdrug",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "core_concepts.md", type: "file" },
          { name: "datasets.md", type: "file" },
          { name: "knowledge_graphs.md", type: "file" },
          { name: "models_architectures.md", type: "file" },
          { name: "molecular_generation.md", type: "file" },
          { name: "molecular_property_prediction.md", type: "file" },
          { name: "protein_modeling.md", type: "file" },
          { name: "retrosynthesis.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "torch-geometric",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "datasets_reference.md", type: "file" },
          { name: "layers_reference.md", type: "file" },
          { name: "transforms_reference.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "benchmark_model.py", type: "file" },
          { name: "create_gnn_template.py", type: "file" },
          { name: "visualize_graph.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "transformers",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "generation.md", type: "file" },
          { name: "models.md", type: "file" },
          { name: "pipelines.md", type: "file" },
          { name: "tokenizers.md", type: "file" },
          { name: "training.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "treatment-plans",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          { name: "chronic_disease_management_plan.tex", type: "file" },
          { name: "general_medical_treatment_plan.tex", type: "file" },
          { name: "medical_treatment_plan.sty", type: "file" },
          { name: "mental_health_treatment_plan.tex", type: "file" },
          { name: "one_page_treatment_plan.tex", type: "file" },
          { name: "pain_management_plan.tex", type: "file" },
          { name: "perioperative_care_plan.tex", type: "file" },
          { name: "quality_checklist.md", type: "file" },
          { name: "rehabilitation_treatment_plan.tex", type: "file" },
          { name: "STYLING_QUICK_REFERENCE.md", type: "file" },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "goal_setting_frameworks.md", type: "file" },
          { name: "intervention_guidelines.md", type: "file" },
          { name: "README.md", type: "file" },
          { name: "regulatory_compliance.md", type: "file" },
          { name: "specialty_specific_guidelines.md", type: "file" },
          { name: "treatment_plan_standards.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "check_completeness.py", type: "file" },
          { name: "generate_template.py", type: "file" },
          { name: "timeline_generator.py", type: "file" },
          { name: "validate_treatment_plan.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "twitter-algorithm-optimizer",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "typescript-advanced",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "umap-learn",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "uniprot-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api_examples.md", type: "file" },
          { name: "api_fields.md", type: "file" },
          { name: "id_mapping_databases.md", type: "file" },
          { name: "query_syntax.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "uniprot_client.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "usfiscaldata",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "api-basics.md", type: "file" },
          { name: "datasets-debt.md", type: "file" },
          { name: "datasets-fiscal.md", type: "file" },
          { name: "datasets-interest-rates.md", type: "file" },
          { name: "datasets-securities.md", type: "file" },
          { name: "examples.md", type: "file" },
          { name: "parameters.md", type: "file" },
          { name: "response-format.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "uspto-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "additional_apis.md", type: "file" },
          { name: "patentsearch_api.md", type: "file" },
          { name: "peds_api.md", type: "file" },
          { name: "trademark_api.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "patent_search.py", type: "file" },
          { name: "peds_client.py", type: "file" },
          { name: "trademark_client.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "vaex",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [
          { name: "core_dataframes.md", type: "file" },
          { name: "data_processing.md", type: "file" },
          { name: "io_operations.md", type: "file" },
          { name: "machine_learning.md", type: "file" },
          { name: "performance.md", type: "file" },
          { name: "visualization.md", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "venue-templates",
    type: "folder",
    children: [
      {
        name: "assets",
        type: "folder",
        children: [
          {
            name: "examples",
            type: "folder",
            children: [
              { name: "cell_summary_example.md", type: "file" },
              { name: "medical_structured_abstract.md", type: "file" },
              { name: "nature_abstract_examples.md", type: "file" },
              { name: "neurips_introduction_example.md", type: "file" },
            ],
          },
          {
            name: "grants",
            type: "folder",
            children: [
              { name: "nih_specific_aims.tex", type: "file" },
              { name: "nsf_proposal_template.tex", type: "file" },
            ],
          },
          {
            name: "journals",
            type: "folder",
            children: [
              { name: "nature_article.tex", type: "file" },
              { name: "neurips_article.tex", type: "file" },
              { name: "plos_one.tex", type: "file" },
            ],
          },
          {
            name: "posters",
            type: "folder",
            children: [{ name: "beamerposter_academic.tex", type: "file" }],
          },
        ],
      },
      {
        name: "references",
        type: "folder",
        children: [
          { name: "cell_press_style.md", type: "file" },
          { name: "conferences_formatting.md", type: "file" },
          { name: "cs_conference_style.md", type: "file" },
          { name: "grants_requirements.md", type: "file" },
          { name: "journals_formatting.md", type: "file" },
          { name: "medical_journal_styles.md", type: "file" },
          { name: "ml_conference_style.md", type: "file" },
          { name: "nature_science_style.md", type: "file" },
          { name: "posters_guidelines.md", type: "file" },
          { name: "reviewer_expectations.md", type: "file" },
          { name: "venue_writing_styles.md", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "customize_template.py", type: "file" },
          { name: "query_template.py", type: "file" },
          { name: "validate_format.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "video-downloader",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "download_video.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "webapp-testing",
    type: "folder",
    children: [
      {
        name: "examples",
        type: "folder",
        children: [
          { name: "console_logging.py", type: "file" },
          { name: "element_discovery.py", type: "file" },
          { name: "static_html_automation.py", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [{ name: "with_server.py", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "web-artifacts-builder",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "bundle-artifact.sh", type: "file" },
          { name: "init-artifact.sh", type: "file" },
          { name: "shadcn-components.tar.gz", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "websocket-realtime",
    type: "folder",
    children: [{ name: "SKILL.md", type: "file" }],
  },
  {
    name: "what-if-oracle",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "scenario-templates.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "xlsx",
    type: "folder",
    children: [
      {
        name: "scripts",
        type: "folder",
        children: [
          {
            name: "office",
            type: "folder",
            children: [
              {
                name: "helpers",
                type: "folder",
                children: [
                  { name: "__init__.py", type: "file" },
                  { name: "merge_runs.py", type: "file" },
                  { name: "simplify_redlines.py", type: "file" },
                ],
              },
              {
                name: "schemas",
                type: "folder",
                children: [
                  {
                    name: "ecma",
                    type: "folder",
                    children: [
                      {
                        name: "fouth-edition",
                        type: "folder",
                        children: [
                          { name: "opc-contentTypes.xsd", type: "file" },
                          { name: "opc-coreProperties.xsd", type: "file" },
                          { name: "opc-digSig.xsd", type: "file" },
                          { name: "opc-relationships.xsd", type: "file" },
                        ],
                      },
                    ],
                  },
                  {
                    name: "ISO-IEC29500-4_2016",
                    type: "folder",
                    children: [
                      { name: "dml-chart.xsd", type: "file" },
                      { name: "dml-chartDrawing.xsd", type: "file" },
                      { name: "dml-diagram.xsd", type: "file" },
                      { name: "dml-lockedCanvas.xsd", type: "file" },
                      { name: "dml-main.xsd", type: "file" },
                      { name: "dml-picture.xsd", type: "file" },
                      { name: "dml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "dml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "pml.xsd", type: "file" },
                      {
                        name: "shared-additionalCharacteristics.xsd",
                        type: "file",
                      },
                      { name: "shared-bibliography.xsd", type: "file" },
                      { name: "shared-commonSimpleTypes.xsd", type: "file" },
                      {
                        name: "shared-customXmlDataProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-customXmlSchemaProperties.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesCustom.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesExtended.xsd",
                        type: "file",
                      },
                      {
                        name: "shared-documentPropertiesVariantTypes.xsd",
                        type: "file",
                      },
                      { name: "shared-math.xsd", type: "file" },
                      {
                        name: "shared-relationshipReference.xsd",
                        type: "file",
                      },
                      { name: "sml.xsd", type: "file" },
                      { name: "vml-main.xsd", type: "file" },
                      { name: "vml-officeDrawing.xsd", type: "file" },
                      { name: "vml-presentationDrawing.xsd", type: "file" },
                      { name: "vml-spreadsheetDrawing.xsd", type: "file" },
                      { name: "vml-wordprocessingDrawing.xsd", type: "file" },
                      { name: "wml.xsd", type: "file" },
                      { name: "xml.xsd", type: "file" },
                    ],
                  },
                  {
                    name: "mce",
                    type: "folder",
                    children: [{ name: "mc.xsd", type: "file" }],
                  },
                  {
                    name: "microsoft",
                    type: "folder",
                    children: [
                      { name: "wml-2010.xsd", type: "file" },
                      { name: "wml-2012.xsd", type: "file" },
                      { name: "wml-2018.xsd", type: "file" },
                      { name: "wml-cex-2018.xsd", type: "file" },
                      { name: "wml-cid-2016.xsd", type: "file" },
                      { name: "wml-sdtdatahash-2020.xsd", type: "file" },
                      { name: "wml-symex-2015.xsd", type: "file" },
                    ],
                  },
                ],
              },
              {
                name: "validators",
                type: "folder",
                children: [
                  { name: "__init__.py", type: "file" },
                  { name: "base.py", type: "file" },
                  { name: "docx.py", type: "file" },
                  { name: "pptx.py", type: "file" },
                  { name: "redlining.py", type: "file" },
                ],
              },
              { name: "pack.py", type: "file" },
              { name: "soffice.py", type: "file" },
              { name: "unpack.py", type: "file" },
              { name: "validate.py", type: "file" },
            ],
          },
          { name: "recalc.py", type: "file" },
        ],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "zarr-python",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
  {
    name: "zinc-database",
    type: "folder",
    children: [
      {
        name: "references",
        type: "folder",
        children: [{ name: "api_reference.md", type: "file" }],
      },
      { name: "SKILL.md", type: "file" },
    ],
  },
];

assertStarterSkillTreeNames(starterSkillsStructureData);
deepFreeze(starterSkillsStructureData);

export const starterSkillsStructure: FileItem[] = starterSkillsStructureData;
