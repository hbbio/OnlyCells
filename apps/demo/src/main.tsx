import { catchRender, mount } from "@nodiffjs/core";
import { App, router } from "./app";

router.start();
mount("#app", catchRender({ render: App }));
