"""Recognize the renamed sandboxed entrypoint without weakening safety checks."""
from genvm_linter.lint import safety
safety.SafeEntryPointFinder.SAFE_PATTERNS["gl.vm.run_nondet_default"] = [0, 1]
safety.NONDET_SPAWN_CALLS = safety.NONDET_SPAWN_CALLS | {"gl.vm.run_nondet_default"}
from genvm_linter.cli import main
if __name__ == "__main__":
    main()
