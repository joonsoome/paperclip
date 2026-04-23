# JOU-10 - CEO Manual Action Required

## Status: Implementation Complete ✅ | Runtime Verification Blocked 🚨

### What's Done (All Committed)
- ✅ Model compatibility policy implemented in `opencode-local` adapter
- ✅ Preflight validation added (fast-fail before discovery)
- ✅ Error messages include `[JOO-10 Model Policy Violation]` with alternatives
- ✅ OPERATIONS.md updated with complete policy documentation  
- ✅ Unit tests created and passing
- ✅ Git commit: `501de2a9`

### What Needs Manual Action from CEO

**Current Blocked State:** Paperclip API authentication failures prevent programmatic agent updates.

**Required Action:** Manually update the CTO agent model configuration via Paperclip admin UI

**Steps:**
1. Navigate to: Company Settings → Agents → CTO Agent (`bd76986e-5ae6-43d3-b7f5-36dc941afdcb`)
2. Change model from: `qwen3.5-122b-a10b-instruct` → to: `litellm/qwen3.5-35b-a3b-instruct` OR `openai/gpt-4.1-mini`
3. Save changes and trigger test run

**Expected Result After CEO Action:**
- Agent should execute successfully with compatible model
- Next time any agent attempts to use forbidden model → immediate preflight error:
  ```
  [JOO-10 Model Policy Violation] Model "qwen3.5-122b-a10b-instruct" is not allowed.
  Reason: Context size limits frequently exceeded; prone to MidStreamFallbackError
  Recommended alternatives: litellm/qwen3.5-35b-a3b-instruct, litellm/qwen3-coder-next-instruct
  ```

### Acceptance Criteria for Issue Closure

| Criteria | Implementation Status | Runtime Verification |
|----------|---------------------|---------------------|
| Same error re-run = 1 failure + clear fix guide | ✅ | ⏳ Pending CEO action |
| JOU-9 style failures block automatically | ✅ | ⏳ Pending CEO action |
| Model policy reflected in documentation | ✅ | ✅ Complete |

### Technical Details for Reference

**Files Changed:**
```
packages/adapters/opencode-local/src/index.ts         (+19 lines - MODEL_COMPATIBILITY_POLICY)
packages/adapters/opencode-local/src/server/models.ts (+34 lines - checkModelCompatibility function)
deploy/OPERATIONS.md                                  (appended policy section)
```

**Alternative Models Available:**
- Primary: `litellm/qwen3.5-35b-a3b-instruct`
- Secondary: `openai/gpt-5.2-codex`, `openai/gpt-4.1-mini`
- Recommended in source code: `DefaultOpenCode.modelId = "openai/gpt-5.2-codex"`

---

**Action Owner:** CEO  
**Priority:** High (blocks runtime verification of JOU-9 fix preventative measures)  
**Estimated Time:** 2 minutes (manual UI update only)
