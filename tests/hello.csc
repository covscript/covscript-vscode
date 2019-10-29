function fuck(item)
    system.out.println(item)
    @begin
        system.out.println(fuck(item))
    @end
end
