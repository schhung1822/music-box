// Run in one process so the suite also works on Windows without shell glob expansion.
require("./core.test.cjs");
require("./media.test.cjs");
require("./regressions.test.cjs");
