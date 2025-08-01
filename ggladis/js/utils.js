// 衝突判定 (AABB: Axis-Aligned Bounding Box)
function isColliding(rect1, rect2) {
    if (!rect1 || !rect2) return false;
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}