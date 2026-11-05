"""Demo of the shared base: open a part on the outline, a short loopviz run, close the part.
Not a script scene. It borrows the length and the term state of `event_loop` (part_loop):
the outline shows what the viewer knows at that scene, and the demo uses only words taught by then."""
from dwscene import *


class DemoLoopviz(DWScene):
    SCENE = "event_loop"
    BEATS = [("open", 2), ("setup", 1.5), ("push", 3), ("tasks", 3), ("drain", 4), ("close", 2)]

    def construct(self):
        outline = OutlineDiagram(self)
        with self.beat("open") as b:
            self.add(outline)
            self.wait(b.t(0.2))
            # f_event_loop is taught in this scene: open_part brings it in with the light
            outline.open_part(self, "f_event_loop", also=("widget_code",), run_time=b.left)

        with self.beat("setup") as b:
            title = scene_title("One turn of the event loop (demo)", LOOP)
            stack = CallStack(width=3.4, max_frames=5).move_to([-4.3, -0.15, 0])
            tasks = LoopQueue("task queue", TASK, width=6.2, shape="ball").move_to([2.6, 1.7, 0])
            loop = LoopArrow().move_to([-0.6, -0.5, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), FadeIn(tasks), FadeIn(loop),
                      run_time=b.t(0.8))

        with self.beat("push") as b:
            self.play(stack.push("main()"), run_time=b.t(0.2))
            self.play(stack.push_cube("sync code", slots=2), run_time=b.t(0.2))
            self.play(tasks.enqueue("task 1"), tasks.enqueue("task 2"), loop.freeze(), run_time=b.t(0.25))
            self.play(stack.pop(), run_time=b.t(0.15))

        with self.beat("tasks") as b:
            self.play(stack.pop(), loop.thaw(), run_time=b.t(0.2))
            note = caption("stack empty: the loop takes the next task")
            self.play(FadeIn(note), loop.turn(), run_time=b.t(0.4))

        with self.beat("drain") as b:
            self.play(run_next(tasks, stack), run_time=b.t(0.2))
            self.play(stack.pop(), run_time=b.t(0.12))
            self.play(loop.turn(), run_time=b.t(0.2))
            self.play(run_next(tasks, stack), run_time=b.t(0.2))
            self.play(stack.pop(), run_time=b.t(0.12))
            self.play(loop.sleep(), run_time=b.t(0.12))

        with self.beat("close") as b:
            outline.close_part(self, "f_event_loop", next_key="notice", run_time=b.left)
