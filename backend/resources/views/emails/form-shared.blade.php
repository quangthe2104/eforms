<!DOCTYPE html>
<html lang="vi">
<body style="font-family: Arial, sans-serif; color: #202124; line-height: 1.5;">
    <p><strong>{{ $sharedByName }}</strong> đã chia sẻ biểu mẫu <strong>{{ $formTitle }}</strong> với bạn, vai trò <strong>{{ $roleLabel }}</strong>.</p>
    @if ($note)
        <blockquote style="margin: 12px 0; padding: 8px 12px; border-left: 3px solid #dadce0; color: #5f6368;">{{ $note }}</blockquote>
    @endif
    <p>
        <a href="{{ $url }}" style="display: inline-block; padding: 10px 20px; background: #1a73e8; color: #fff; text-decoration: none; border-radius: 4px;">Mở biểu mẫu</a>
    </p>
</body>
</html>
