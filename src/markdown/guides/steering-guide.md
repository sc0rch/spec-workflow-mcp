# Steering Workflow

Use steering docs only when the user explicitly asks for project-level guidance documents.

## Order

1. `product.md`
2. `tech.md`
3. `structure.md`

## Process

### Product

1. Read `.spec-workflow/templates/product-template.md`
2. Create `.spec-workflow/steering/product.md`
3. Request approval with:

```bash
spec-workflow approvals request \
  --title "Review steering product doc" \
  --file-path ".spec-workflow/steering/product.md" \
  --type document \
  --category steering \
  --category-name "steering" \
  --json
```

### Tech

1. Read `.spec-workflow/templates/tech-template.md`
2. Create `.spec-workflow/steering/tech.md`
3. Request approval

### Structure

1. Read `.spec-workflow/templates/structure-template.md`
2. Create `.spec-workflow/steering/structure.md`
3. Request approval

## Rules

- Create steering docs only when explicitly requested
- Keep approval gates between documents
- Do not continue while an approval is still pending
